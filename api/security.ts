import type { IncomingMessage, ServerResponse } from 'node:http'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

const rateBuckets = new Map<string, { count: number; resetAt: number }>()
const defaultAllowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5175',
  'http://localhost:3002',
  'http://127.0.0.1:3002',
  'https://myjobmatcher.vercel.app',
])

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

export function setSecurityHeaders(res: ServerResponse) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.setHeader('Cache-Control', 'no-store')
}

export function setCors(req: IncomingMessage, res: ServerResponse, methods: string[]) {
  setSecurityHeaders(res)
  const origin = req.headers.origin
  const allowedOrigins = getAllowedOrigins()
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', [...methods, 'OPTIONS'].join(', '))
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export function handleOptions(req: IncomingMessage, res: ServerResponse, methods: string[]) {
  setCors(req, res, methods)
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return true
  }
  return false
}

export function requireMethod(req: IncomingMessage, methods: string[]) {
  if (!req.method || !methods.includes(req.method)) {
    throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Use ${methods.join(' or ')}.`)
  }
}

export function enforceRateLimit(req: IncomingMessage, route: string, maxRequests: number, windowMs: number) {
  const ip = getClientIp(req)
  const key = `${route}:${ip}`
  const now = Date.now()
  const bucket = rateBuckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }

  bucket.count += 1
  if (bucket.count > maxRequests) {
    throw new ApiError(429, 'RATE_LIMITED', 'Too many requests. Try again shortly.')
  }
}

export function sendJson(res: ServerResponse, status: number, payload: unknown) {
  setSecurityHeaders(res)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

export function sendError(res: ServerResponse, error: unknown, fallbackCode: string) {
  if (error instanceof ApiError) {
    sendJson(res, error.status, { error: { code: error.code, message: error.message } })
    return
  }

  sendJson(res, 500, {
    error: {
      code: fallbackCode,
      message: 'The request could not be completed safely.',
    },
  })
}

export function parseSearchParams<T extends z.ZodTypeAny>(req: IncomingMessage, schema: T): z.infer<T> {
  const url = new URL(req.url || '/', 'http://localhost')
  const raw = Object.fromEntries(url.searchParams.entries())
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    throw new ApiError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid request.')
  }
  return parsed.data
}

export function sanitiseFilename(filename: string) {
  const base = filename.split(/[\\/]/).pop() || 'uploaded-cv'
  return base
    .replace(/[^\w.\-() ]+/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 160)
    .trim() || 'uploaded-cv'
}

export function assertSafeContentType(req: IncomingMessage, expected: string) {
  const contentType = req.headers['content-type'] || ''
  if (!contentType.toLowerCase().includes(expected)) {
    throw new ApiError(400, 'INVALID_CONTENT_TYPE', `Expected ${expected}.`)
  }
}

function getAllowedOrigins() {
  const origins = new Set(defaultAllowedOrigins)
  for (const value of [process.env.VITE_APP_URL, process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '']) {
    if (value) origins.add(value.replace(/\/$/, ''))
  }
  return origins
}

function getClientIp(req: IncomingMessage) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim()
  return req.socket.remoteAddress || 'unknown'
}

// --- Service-role client + admin caller verification (for api/admin.ts) ---

let serviceClient: SupabaseClient | null = null

export function getServiceClient(): SupabaseClient {
  if (serviceClient) return serviceClient
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new ApiError(503, 'ADMIN_NOT_CONFIGURED', 'Admin API requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  }
  serviceClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return serviceClient
}

export interface AdminCaller {
  id: string
  email: string
  role: 'admin' | 'superadmin'
}

function getBearerToken(req: IncomingMessage): string {
  const header = req.headers['authorization']
  const value = Array.isArray(header) ? header[0] : header
  if (!value || !value.toLowerCase().startsWith('bearer ')) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Missing bearer token.')
  }
  return value.slice(7).trim()
}

/**
 * Verifies the caller's Supabase access token and confirms their profile role
 * is admin (or superadmin). Throws ApiError on any failure. RLS stays untouched;
 * this is the single gate for cross-user admin reads.
 */
export async function requireAdminCaller(
  req: IncomingMessage,
  options: { superadmin?: boolean } = {},
): Promise<AdminCaller> {
  const token = getBearerToken(req)
  const client = getServiceClient()

  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Invalid or expired session.')
  }

  const { data: profile, error: profileError } = await client
    .from('users')
    .select('id, email, role, is_active')
    .eq('id', data.user.id)
    .single()

  if (profileError || !profile) {
    throw new ApiError(403, 'FORBIDDEN', 'Account profile not found.')
  }
  if (!profile.is_active || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
    throw new ApiError(403, 'FORBIDDEN', 'Admin access is required for this action.')
  }
  if (options.superadmin && profile.role !== 'superadmin') {
    throw new ApiError(403, 'FORBIDDEN', 'Superadmin access is required for this action.')
  }

  return { id: profile.id as string, email: profile.email as string, role: profile.role as 'admin' | 'superadmin' }
}
