import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = 'http://127.0.0.1:3002'
const OUT = process.argv[2] || '/tmp/shots'
const EMAIL = process.env.SHOT_EMAIL || 'seemakram15@gmail.com'
const PASSWORD = process.env.SHOT_PASSWORD || ''

mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function shoot(page, name, full = true) {
  await sleep(900)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full })
  console.log('shot', name)
}

const main = async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultTimeout(20000)

  // Public pages
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await shoot(page, '01-landing')
  await page.goto(`${BASE}/auth?mode=signin`, { waitUntil: 'networkidle' })
  await shoot(page, '02-auth', false)

  // Sign in as superadmin
  await page.fill('input[type=email]', EMAIL)
  await page.fill('input[type=password]', PASSWORD)
  await page.click('form button.primary-button')
  await page.waitForFunction(() => !location.pathname.startsWith('/auth'), { timeout: 20000 }).catch(() => {})
  await sleep(1500)

  const routes = [
    ['dashboard', '03-dashboard'],
    ['jobs', '04-find-jobs'],
    ['cv', '05-my-cv'],
    ['tracker', '06-applications'],
    ['profile', '07-preferences'],
    ['alerts', '08-alerts'],
    ['admin', '09-admin'],
    ['settings', '10-settings'],
  ]
  for (const [route, name] of routes) {
    await page.goto(`${BASE}/${route}`, { waitUntil: 'networkidle' }).catch(() => {})
    await shoot(page, name)
  }

  // Light theme on dashboard
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' }).catch(() => {})
  await page.click('button[aria-label*="theme"]').catch(() => {})
  await shoot(page, '11-dashboard-light')
  await page.click('button[aria-label*="theme"]').catch(() => {}) // back to dark

  // Impersonation: View as first user from admin
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' }).catch(() => {})
  await sleep(1500)
  const viewAs = page.locator('button:has-text("View as")').first()
  if (await viewAs.count()) {
    await viewAs.click().catch(() => {})
    await page.waitForFunction(() => location.pathname === '/dashboard', { timeout: 15000 }).catch(() => {})
    await shoot(page, '12-impersonation')
  }

  await browser.close()
  console.log('DONE')
}

main().catch((error) => {
  console.error('screenshot failed:', error)
  process.exit(1)
})
