import { requireSupabase } from './supabase'
import { buildWorkspaceFromRows, type WorkspaceRows } from './workspacePersistence'
import type { AdminOverview, ImpersonationSnapshot, UserRole } from '../types'

async function authHeaders(): Promise<Record<string, string>> {
  const client = requireSupabase()
  const { data } = await client.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('You must be signed in to use admin tools.')
  return { Authorization: `Bearer ${token}` }
}

async function parseResponse(res: Response) {
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = (json as { error?: { message?: string } })?.error?.message || 'Admin request failed.'
    throw new Error(message)
  }
  return json
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const headers = await authHeaders()
  const res = await fetch('/api/admin?action=overview', { headers })
  return (await parseResponse(res)) as AdminOverview
}

export async function getUserWorkspace(userId: string): Promise<ImpersonationSnapshot> {
  const headers = await authHeaders()
  const res = await fetch(`/api/admin?action=workspace&userId=${encodeURIComponent(userId)}`, { headers })
  const rows = (await parseResponse(res)) as WorkspaceRows
  return buildWorkspaceFromRows(rows)
}

export async function setUserRole(userId: string, role: UserRole): Promise<void> {
  const headers = await authHeaders()
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'set-role', userId, role }),
  })
  await parseResponse(res)
}
