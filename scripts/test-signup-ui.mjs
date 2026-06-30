import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright-core'

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
const admin = createClient(env.SUPABASE_URL || env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = 'http://127.0.0.1:3002'
const OUT = process.argv[2] || '/tmp/shots3'
const email = `seemakram15+uitest${Date.now()}@gmail.com`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const main = async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultTimeout(20000)

  await page.goto(`${BASE}/auth?mode=signup`, { waitUntil: 'networkidle' })
  await page.fill('input[placeholder="Your name"]', 'UI Test User')
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', 'TestConfirm123!')
  await page.click('form button.primary-button')
  await sleep(4000) // allow API + Brevo send
  await page.screenshot({ path: `${OUT}/signup-confirmation.png`, fullPage: false })
  console.log('shot signup-confirmation for', email)

  await browser.close()

  // cleanup throwaway user
  let userId = null
  for (let p = 1; p <= 10 && !userId; p++) {
    const { data } = await admin.auth.admin.listUsers({ page: p, perPage: 200 })
    const u = (data?.users || []).find((x) => (x.email || '').toLowerCase() === email)
    if (u) userId = u.id
    if (!data?.users?.length || data.users.length < 200) break
  }
  if (userId) {
    await admin.auth.admin.deleteUser(userId)
    await admin.from('users').delete().eq('id', userId)
    console.log('cleaned up', email)
  } else {
    console.log('test user not found for cleanup (may not have been created):', email)
  }
  console.log('DONE')
}

main().catch((e) => {
  console.error('UI test failed:', e.message)
  process.exit(1)
})
