import type { IncomingMessage, ServerResponse } from 'node:http'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
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

const deleteAccountSchema = z.object({
  email: z.string().trim().email('Enter your account email.').max(254),
  password: z.string().min(1, 'Password is required.').max(128),
  confirmation: z.string().trim(),
})

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  setCors(req, res, ['POST'])
  if (handleOptions(req, res, ['POST'])) return

  try {
    requireMethod(req, ['POST'])
    enforceRateLimit(req, 'delete-account', 8, 60 * 60_000)

    const caller = await requireAuthenticatedCaller(req)
    enforceRateLimitByKey(req, 'delete-account-user', caller.id, 4, 60 * 60_000)

    const input = deleteAccountSchema.parse(await readJson(req))
    const email = input.email.toLowerCase()
    if (input.confirmation !== 'DELETE') {
      throw new ApiError(400, 'CONFIRMATION_REQUIRED', 'Type DELETE to confirm account deletion.')
    }
    if (email !== caller.email.toLowerCase()) {
      throw new ApiError(400, 'EMAIL_MISMATCH', 'Enter the email address for the signed-in account.')
    }

    await verifyPassword(email, input.password)
    await deleteUserAccount(caller.id)

    sendJson(res, 200, { ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendJson(res, 400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: error.issues[0]?.message || 'Invalid deletion request.',
        },
      })
      return
    }

    sendError(res, error, 'DELETE_ACCOUNT_FAILED')
  }
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

async function deleteUserAccount(userId: string) {
  const client = getServiceClient()

  await removeCvStorage(client, userId).catch((error) => {
    console.error('Account storage cleanup failed:', error instanceof Error ? error.message : error)
  })

  const { error: changedByError } = await client.from('application_history').delete().eq('changed_by', userId)
  if (changedByError) throw accountDeleteFailure(changedByError.message)

  const { error: profileError } = await client.from('users').delete().eq('id', userId)
  if (profileError) throw accountDeleteFailure(profileError.message)

  const { error: authError } = await client.auth.admin.deleteUser(userId)
  if (authError) throw accountDeleteFailure(authError.message)
}

function accountDeleteFailure(message: string) {
  console.error('Account deletion failed:', message)
  return new ApiError(500, 'ACCOUNT_DELETE_FAILED', 'Account deletion could not be completed safely.')
}

async function removeCvStorage(client: SupabaseClient, userId: string) {
  const bucket = client.storage.from('cvs')
  const paths = await listStoragePaths(client, userId)
  if (paths.length) await bucket.remove(paths)
}

async function listStoragePaths(client: SupabaseClient, prefix: string): Promise<string[]> {
  const bucket = client.storage.from('cvs')
  const { data, error } = await bucket.list(prefix, { limit: 1000 })
  if (error || !data?.length) return []

  const paths: string[] = []
  for (const item of data) {
    const path = `${prefix}/${item.name}`
    if (item.id || item.metadata) {
      paths.push(path)
    } else {
      paths.push(...(await listStoragePaths(client, path)))
    }
  }
  return paths
}
