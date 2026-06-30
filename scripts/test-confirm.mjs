// Validates the signup-confirmation mechanism against live Supabase, then cleans up.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = {}
for (const line of readFileSync(join(root, '.env.local'), 'utf8').split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i < 0) continue
  let v = t.slice(i + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  env[t.slice(0, i).trim()] = v
}

const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

const email = `seemakram15+conftest${Date.now()}@gmail.com`
const password = 'TestConfirm123!'

const main = async () => {
  // 1. Create unconfirmed user + signup confirmation token (what the API does).
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
    options: { data: { full_name: 'Confirm Test' } },
  })
  if (error) throw new Error(`generateLink failed: ${error.message}`)
  const tokenHash = data.properties?.hashed_token
  const userId = data.user?.id
  console.log('created unconfirmed user:', userId, '| email_confirmed_at:', data.user?.email_confirmed_at ?? null)

  // 2. Simulate clicking the email link → verifyOtp signup (what the store does).
  const { data: verifyData, error: verifyError } = await anon.auth.verifyOtp({ type: 'signup', token_hash: tokenHash })
  console.log('verifyOtp(signup) → session established:', Boolean(verifyData?.session), '| error:', verifyError?.message ?? 'none')

  // 3. Confirm the account is now verified.
  const { data: after } = await admin.auth.admin.getUserById(userId)
  console.log('after verify → email_confirmed_at:', after?.user?.email_confirmed_at ?? null)

  // 4. Cleanup throwaway user.
  await admin.auth.admin.deleteUser(userId)
  await admin.from('users').delete().eq('id', userId)
  console.log('cleaned up throwaway user')
}

main().catch((e) => {
  console.error('TEST FAILED:', e.message)
  process.exit(1)
})
