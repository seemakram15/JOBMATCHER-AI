// One-off setup: applies migration 005 and creates/promotes the superadmin.
// Usage: node scripts/admin-setup.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import crypto from 'node:crypto'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function loadEnv() {
  const env = {}
  try {
    const raw = readFileSync(join(root, '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      env[key] = value
    }
  } catch {
    // fall back to process.env
  }
  return { ...env, ...process.env }
}

function strongPassword() {
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnpqrstuvwxyz'
  const digits = '23456789'
  const symbols = '!@#$%^&*-_'
  const all = upper + lower + digits + symbols
  const pick = (set) => set[crypto.randomInt(set.length)]
  const base = [pick(upper), pick(lower), pick(digits), pick(symbols)]
  for (let i = 0; i < 12; i++) base.push(pick(all))
  // shuffle
  for (let i = base.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1)
    ;[base[i], base[j]] = [base[j], base[i]]
  }
  return base.join('')
}

const SUPERADMIN_EMAIL = 'seemakram15@gmail.com'

async function applyMigration(databaseUrl) {
  const sql = readFileSync(join(root, 'supabase/migrations/005_admin_roles_and_activity.sql'), 'utf8')
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false },
  })
  await client.connect()
  try {
    await client.query(sql)
    console.log('✓ Migration 005 applied (superadmin role, is_superadmin(), search_events).')
  } finally {
    await client.end()
  }
}

async function ensureSuperadmin(admin) {
  // Find existing auth user by email (paginate a bit).
  let existing = null
  for (let page = 1; page <= 10 && !existing; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    existing = (data?.users || []).find((u) => (u.email || '').toLowerCase() === SUPERADMIN_EMAIL)
    if (!data?.users?.length || data.users.length < 200) break
  }

  const password = strongPassword()
  let userId

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true })
    if (error) throw error
    userId = existing.id
    console.log(`✓ Reset password for existing account ${SUPERADMIN_EMAIL}.`)
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: SUPERADMIN_EMAIL,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Seema Kram', email_verified: true },
    })
    if (error) throw error
    userId = data.user.id
    console.log(`✓ Created account ${SUPERADMIN_EMAIL}.`)
  }

  // Upsert the public.users profile row with the superadmin role.
  const { error: profileError } = await admin.from('users').upsert(
    {
      id: userId,
      email: SUPERADMIN_EMAIL,
      name: 'Seema Kram',
      role: 'superadmin',
      is_active: true,
      location: 'Remote',
      preferred_countries: ['Remote'],
      preferred_cities: ['Remote'],
      remote_preference: 'remote',
      preferred_remote: true,
      currency: 'USD',
    },
    { onConflict: 'id' },
  )
  if (profileError) throw profileError

  // Make sure role is superadmin even if the row already existed.
  const { error: roleError } = await admin.from('users').update({ role: 'superadmin', is_active: true }).eq('id', userId)
  if (roleError) throw roleError

  console.log('✓ Promoted to superadmin in public.users.')
  return password
}

async function main() {
  const env = loadEnv()
  const databaseUrl = env.DATABASE_URL
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!databaseUrl) throw new Error('DATABASE_URL missing in .env.local')
  if (!supabaseUrl || !serviceKey) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in .env.local')

  await applyMigration(databaseUrl)

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const password = await ensureSuperadmin(admin)

  console.log('\n========================================')
  console.log('SUPERADMIN READY')
  console.log(`  email:    ${SUPERADMIN_EMAIL}`)
  console.log(`  password: ${password}`)
  console.log('========================================\n')
}

main().catch((error) => {
  console.error('Setup failed:', error.message || error)
  process.exit(1)
})
