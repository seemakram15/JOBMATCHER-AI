import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = 'http://127.0.0.1:3002'
const OUT = process.argv[2] || '/tmp/shots2'
const EMAIL = process.env.SHOT_EMAIL || 'seemakram15@gmail.com'
const PASSWORD = process.env.SHOT_PASSWORD || ''
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const main = async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultTimeout(20000)

  // login
  await page.goto(`${BASE}/auth?mode=signin`, { waitUntil: 'networkidle' })
  await page.fill('input[type=email]', EMAIL)
  await page.fill('input[type=password]', PASSWORD)
  await page.click('form button.primary-button')
  await page.waitForFunction(() => !location.pathname.startsWith('/auth'), { timeout: 20000 }).catch(() => {})
  await sleep(1200)

  // Find Jobs → open Filters → open Source dropdown
  await page.goto(`${BASE}/jobs`, { waitUntil: 'networkidle' })
  await sleep(800)
  await page.click('button:has-text("Filters")').catch(() => {})
  await sleep(700)
  await page.click('button[aria-label="Source platform"]').catch(() => {})
  await sleep(700)
  await page.screenshot({ path: `${OUT}/jobs-source-dropdown.png` })
  console.log('shot jobs-source-dropdown')

  // My CV → open Country dropdown
  await page.goto(`${BASE}/cv`, { waitUntil: 'networkidle' })
  await sleep(900)
  await page.click('button[aria-label="Country"]').catch(() => {})
  await sleep(700)
  await page.screenshot({ path: `${OUT}/mycv-country-dropdown.png` })
  console.log('shot mycv-country-dropdown')

  // Landing footer (bottom of page)
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await sleep(600)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await sleep(900)
  await page.screenshot({ path: `${OUT}/landing-footer.png` })
  console.log('shot landing-footer')

  await browser.close()
  console.log('DONE')
}

main().catch((e) => {
  console.error('verify failed:', e)
  process.exit(1)
})
