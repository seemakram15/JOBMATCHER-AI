import type { IncomingMessage, ServerResponse } from 'node:http'
import { createClient } from '@supabase/supabase-js'
import { Client } from 'pg'
import { z } from 'zod'
import { sanitiseAvatarUrl, sanitiseText } from '../src/lib/security.js'
import {
  ApiError,
  enforceRateLimit,
  enforceRateLimitByKey,
  getServiceClient,
  handleOptions,
  readJson,
  requireAuthenticatedCaller,
  requireMethod,
  sendError,
  sendJson,
  setCors,
} from './security.js'

const accountProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(160),
  email: z.string().trim().email('Enter a valid email.').max(254),
  avatarUrl: z.string().max(180_000).nullable().optional(),
  currentPassword: z.string().max(128).optional(),
})

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  setCors(req, res, ['PATCH'])
  if (handleOptions(req, res, ['PATCH'])) return

  try {
    requireMethod(req, ['PATCH'])
    enforceRateLimit(req, 'account-profile', 20, 60 * 60_000)

    const caller = await requireAuthenticatedCaller(req)
    enforceRateLimitByKey(req, 'account-profile-user', caller.id, 12, 60 * 60_000)

    const input = accountProfileSchema.parse(await readJson(req, 210_000))
    const updated = await updateAccountProfile({
      userId: caller.id,
      currentEmail: caller.email.toLowerCase(),
      nextEmail: input.email.toLowerCase(),
      name: sanitiseText(input.name, 160),
      avatarUrl: sanitiseAvatarUrl(input.avatarUrl || ''),
      currentPassword: input.currentPassword || '',
      req,
    })

    sendJson(res, 200, { profile: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendJson(res, 400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: error.issues[0]?.message || 'Invalid profile data.',
        },
      })
      return
    }

    sendError(res, error, 'ACCOUNT_PROFILE_FAILED')
  }
}

interface UpdateAccountProfileInput {
  userId: string
  currentEmail: string
  nextEmail: string
  name: string
  avatarUrl: string
  currentPassword: string
  req: IncomingMessage
}

async function updateAccountProfile(input: UpdateAccountProfileInput) {
  const client = getServiceClient()
  const emailChanged = input.nextEmail !== input.currentEmail

  if (emailChanged) {
    enforceRateLimitByKey(input.req, 'account-profile-email', input.nextEmail, 4, 60 * 60_000)
    if (!input.currentPassword) {
      throw new ApiError(400, 'PASSWORD_REQUIRED', 'Current password is required to change your email.')
    }
    await verifyPassword(input.currentEmail, input.currentPassword)

    const { error: authError } = await client.auth.admin.updateUserById(input.userId, {
      email: input.nextEmail,
      email_confirm: true,
      user_metadata: {
        full_name: input.name,
        avatar_url: input.avatarUrl,
        email_verified: true,
        phone_verified: false,
      },
    })
    if (authError) throw new ApiError(authError.status || 400, 'EMAIL_UPDATE_FAILED', authError.message)
  } else {
    const { error: authError } = await client.auth.admin.updateUserById(input.userId, {
      user_metadata: {
        full_name: input.name,
        avatar_url: input.avatarUrl,
      },
    })
    if (authError) throw new ApiError(authError.status || 400, 'PROFILE_UPDATE_FAILED', authError.message)
  }

  const profile = await updateProfileRow(input).catch(async (error) => {
    if (emailChanged) {
      await client.auth.admin
        .updateUserById(input.userId, { email: input.currentEmail, email_confirm: true })
        .catch(() => undefined)
    }
    throw error
  })

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name || input.name,
    avatarUrl: profile.avatarUrl,
  }
}

async function updateProfileRow(input: UpdateAccountProfileInput) {
  const client = getServiceClient()
  const { data, error } = await client
    .from('users')
    .update({
      email: input.nextEmail,
      name: input.name,
      avatar_url: input.avatarUrl || null,
    })
    .eq('id', input.userId)
    .select('id, email, name, avatar_url')
    .single()

  if (!error && data) {
    return {
      id: data.id as string,
      email: data.email as string,
      name: (data.name as string) || input.name,
      avatarUrl: (data.avatar_url as string | null) || '',
    }
  }

  if (isProtectedAccountFieldError(error) && isUsableDatabaseUrl(process.env.DATABASE_URL)) {
    return updateProfileRowWithDatabase(process.env.DATABASE_URL, input)
  }

  throw new ApiError(500, 'PROFILE_UPDATE_FAILED', 'Profile could not be updated safely.')
}

async function updateProfileRowWithDatabase(databaseUrl: string, input: UpdateAccountProfileInput) {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false },
  })

  await client.connect()
  try {
    await client.query('begin')
    await client.query(`select set_config('request.jwt.claim.role', 'service_role', true)`)
    const result = await client.query<{ id: string; email: string; name: string | null; avatar_url: string | null }>(
      `
        update public.users
        set email = $2,
            name = $3,
            avatar_url = nullif($4, '')
        where id = $1
        returning id, email, name, avatar_url
      `,
      [input.userId, input.nextEmail, input.name, input.avatarUrl],
    )
    const row = result.rows[0]
    if (!row) throw new Error('Profile row not found.')
    await client.query('commit')

    return {
      id: row.id,
      email: row.email,
      name: row.name || input.name,
      avatarUrl: row.avatar_url || '',
    }
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    console.error('Account profile database update failed:', error instanceof Error ? error.message : error)
    throw new ApiError(500, 'PROFILE_UPDATE_FAILED', 'Profile could not be updated safely.')
  } finally {
    await client.end().catch(() => undefined)
  }
}

function isProtectedAccountFieldError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    String(error.message).toLowerCase().includes('protected account fields')
  )
}

function isUsableDatabaseUrl(url: string | undefined): url is string {
  if (!url) return false
  const normalised = url.trim().toLowerCase()
  return (
    normalised.startsWith('postgres://') ||
    normalised.startsWith('postgresql://')
  ) && !normalised.includes('your-password') && !normalised.includes('dummy') && !normalised.includes('placeholder')
}

async function verifyPassword(email: string, password: string) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!supabaseUrl || !publishableKey) {
    throw new ApiError(503, 'AUTH_NOT_CONFIGURED', 'Account verification is not configured on the server.')
  }

  const client = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect.')
}
