import type { IncomingMessage, ServerResponse } from 'node:http'
import { z } from 'zod'
import {
  ApiError,
  getServiceClient,
  handleOptions,
  parseSearchParams,
  requireAdminCaller,
  requireMethod,
  sendError,
  sendJson,
  setCors,
} from './security.js'

const overviewQuery = z.object({ action: z.literal('overview') })
const workspaceQuery = z.object({ action: z.literal('workspace'), userId: z.string().uuid() })
const setRoleBody = z.object({
  action: z.literal('set-role'),
  userId: z.string().uuid(),
  role: z.enum(['job_seeker', 'admin', 'superadmin']),
})

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  setCors(req, res, ['GET', 'POST'])
  if (handleOptions(req, res, ['GET', 'POST'])) return

  try {
    requireMethod(req, ['GET', 'POST'])

    if (req.method === 'POST') {
      const body = setRoleBody.parse(await readJson(req))
      await requireAdminCaller(req, { superadmin: true })
      await setUserRole(body.userId, body.role)
      sendJson(res, 200, { ok: true })
      return
    }

    const action = new URL(req.url || '/', 'http://localhost').searchParams.get('action')
    if (action === 'workspace') {
      const params = parseSearchParams(req, workspaceQuery)
      await requireAdminCaller(req)
      const rows = await getUserWorkspaceRows(params.userId)
      sendJson(res, 200, rows)
      return
    }

    parseSearchParams(req, overviewQuery)
    await requireAdminCaller(req)
    const overview = await buildOverview()
    sendJson(res, 200, overview)
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendJson(res, 400, { error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || 'Invalid request.' } })
      return
    }
    sendError(res, error, 'ADMIN_REQUEST_FAILED')
  }
}

async function buildOverview() {
  const client = getServiceClient()
  const [usersRes, appsRes, searchesRes, cvsRes] = await Promise.all([
    client.from('users').select('id, email, name, role, is_active, created_at'),
    client.from('applications').select('user_id, status, last_updated'),
    client.from('search_events').select('user_id, created_at'),
    client.from('cvs').select('user_id'),
  ])

  if (usersRes.error) throw new ApiError(500, 'ADMIN_QUERY_FAILED', usersRes.error.message)

  const users = usersRes.data || []
  const apps = appsRes.data || []
  const searches = searchesRes.data || []
  const cvs = cvsRes.data || []

  const byUser = new Map<
    string,
    { applicationCount: number; appliedCount: number; searchCount: number; cvCount: number; lastActiveAt: number }
  >()
  const ensure = (id: string) => {
    let entry = byUser.get(id)
    if (!entry) {
      entry = { applicationCount: 0, appliedCount: 0, searchCount: 0, cvCount: 0, lastActiveAt: 0 }
      byUser.set(id, entry)
    }
    return entry
  }

  for (const app of apps as { user_id: string; status: string; last_updated: string }[]) {
    const entry = ensure(app.user_id)
    entry.applicationCount += 1
    if (app.status === 'applied' || app.status === 'interviewing' || app.status === 'offer') entry.appliedCount += 1
    const ts = Date.parse(app.last_updated || '')
    if (!Number.isNaN(ts)) entry.lastActiveAt = Math.max(entry.lastActiveAt, ts)
  }
  for (const search of searches as { user_id: string; created_at: string }[]) {
    const entry = ensure(search.user_id)
    entry.searchCount += 1
    const ts = Date.parse(search.created_at || '')
    if (!Number.isNaN(ts)) entry.lastActiveAt = Math.max(entry.lastActiveAt, ts)
  }
  for (const cv of cvs as { user_id: string }[]) {
    ensure(cv.user_id).cvCount += 1
  }

  const userStats = (users as {
    id: string
    email: string
    name: string | null
    role: string | null
    is_active: boolean | null
    created_at: string | null
  }[]).map((user) => {
    const entry = byUser.get(user.id)
    return {
      id: user.id,
      email: user.email,
      name: user.name || user.email.split('@')[0],
      role: (user.role || 'job_seeker') as 'job_seeker' | 'admin' | 'superadmin',
      isActive: user.is_active !== false,
      applicationCount: entry?.applicationCount || 0,
      appliedCount: entry?.appliedCount || 0,
      searchCount: entry?.searchCount || 0,
      cvCount: entry?.cvCount || 0,
      lastActiveAt: entry?.lastActiveAt ? new Date(entry.lastActiveAt).toISOString() : null,
      createdAt: user.created_at || null,
    }
  })

  userStats.sort((a, b) => (b.lastActiveAt || '').localeCompare(a.lastActiveAt || ''))

  return {
    totalUsers: userStats.length,
    totalApplications: apps.length,
    totalSearches: searches.length,
    activeUsers: userStats.filter((u) => u.lastActiveAt).length,
    users: userStats,
  }
}

async function getUserWorkspaceRows(userId: string) {
  const client = getServiceClient()
  const [userRes, cvRes, appRes, notificationRes, scoreRes] = await Promise.all([
    client.from('users').select('*').eq('id', userId).single(),
    client.from('cvs').select('*, cv_skills(*), cv_experience(*)').eq('user_id', userId).order('version', { ascending: false }),
    client.from('applications').select('*, application_history(*)').eq('user_id', userId).order('last_updated', { ascending: false }),
    client.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
    client.from('user_job_scores').select('job_id').eq('user_id', userId).order('computed_at', { ascending: false }).limit(100),
  ])

  if (userRes.error || !userRes.data) throw new ApiError(404, 'USER_NOT_FOUND', 'That user could not be found.')

  const appRows = appRes.data || []
  const scoreRows = (scoreRes.data || []) as { job_id: string }[]
  const jobIds = Array.from(
    new Set([
      ...scoreRows.map((row) => row.job_id),
      ...(appRows as { job_id: string }[]).map((row) => row.job_id),
    ].filter(Boolean)),
  )
  const jobRows = jobIds.length ? (await client.from('jobs').select('*').in('id', jobIds)).data || [] : []

  return {
    userRow: userRes.data,
    cvRows: cvRes.data || [],
    appRows,
    notificationRows: notificationRes.data || [],
    jobRows,
  }
}

async function setUserRole(userId: string, role: 'job_seeker' | 'admin' | 'superadmin') {
  const client = getServiceClient()
  const { error } = await client.from('users').update({ role }).eq('id', userId)
  if (error) throw new ApiError(500, 'ROLE_UPDATE_FAILED', error.message)
}

function readJson(req: IncomingMessage) {
  return new Promise<unknown>((resolve, reject) => {
    const contentType = req.headers['content-type'] || ''
    if (!contentType.toLowerCase().includes('application/json')) {
      reject(new ApiError(400, 'INVALID_CONTENT_TYPE', 'Expected application/json.'))
      return
    }
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk: string) => {
      body += chunk
      if (body.length > 16_384) {
        reject(new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'))
      } catch {
        reject(new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.'))
      }
    })
    req.on('error', reject)
  })
}
