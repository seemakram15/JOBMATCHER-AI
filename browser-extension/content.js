(() => {
const BUTTON_ID = 'jobmatcher-floating-save'
const STATUS_ID = 'jobmatcher-floating-status'

if (globalThis.__jobmatcherCaptureBooted) {
  ensureButton()
  return
}
globalThis.__jobmatcherCaptureBooted = true

console.info('[Jobmatcher Capture] content script loaded on', window.location.href)
ensureButton()
new MutationObserver(() => ensureButton()).observe(document.documentElement || document.body, { childList: true, subtree: true })

function ensureButton() {
  if (document.getElementById(BUTTON_ID)) return

  const wrapper = document.createElement('div')
  wrapper.id = BUTTON_ID
  wrapper.innerHTML = `
    <button type="button" class="jobmatcher-save-button">Save to Jobmatcher</button>
    <div id="${STATUS_ID}" class="jobmatcher-save-status"></div>
  `
  ;(document.body || document.documentElement).appendChild(wrapper)
  wrapper.querySelector('button')?.addEventListener('click', () => void saveCurrentJob())
}

async function saveCurrentJob() {
  const button = document.querySelector(`#${BUTTON_ID} button`)
  const status = document.getElementById(STATUS_ID)
  const payload = extractJobPayload()

  if (!payload.title || !payload.applyUrl) {
    setStatus('Open a job detail first.', 'error')
    return
  }

  button.disabled = true
  setStatus('Saving...', 'busy')

  chrome.runtime.sendMessage({ type: 'JOBMATCHER_SAVE_JOB', payload }, (response) => {
    button.disabled = false
    if (response?.ok) {
      setStatus(response.data?.duplicate ? 'Already saved' : 'Saved', 'success')
      window.setTimeout(() => setStatus('', ''), 2200)
      return
    }
    setStatus(response?.reconnect ? 'Reconnect Jobmatcher' : response?.error || 'Save failed', 'error')
  })
}

function extractJobPayload() {
  const selectedText = cleanText(String(window.getSelection?.() || ''), 5000)
  const title =
    firstText([
      'h1',
      '.jobs-unified-top-card__job-title',
      '.job-details-jobs-unified-top-card__job-title',
      '.top-card-layout__title',
      '[data-testid="jobsearch-JobInfoHeader-title"]',
      '[data-test="job-title"]',
      '.styles_jd-header-title__rZwM1',
      '[class*="job-title"]',
      '[class*="title"]',
    ]) ||
    meta('og:title') ||
    document.title
  const company =
    firstText([
      '.jobs-unified-top-card__company-name',
      '.job-details-jobs-unified-top-card__company-name',
      '.topcard__org-name-link',
      '[data-testid="inlineHeader-companyName"]',
      '[data-company-name]',
      '.styles_jd-header-comp-name__MvqAI',
      '[class*="company-name"]',
      '[class*="company"]',
    ]) || ''
  const location =
    firstText([
      '.jobs-unified-top-card__bullet',
      '.job-details-jobs-unified-top-card__primary-description-container [class*="bullet"]',
      '[data-testid="job-location"]',
      '.styles_jhc__location__W_pVs',
      '[class*="job-location"]',
      '[class*="location"]',
    ]) || ''
  const description =
    firstText([
      '#job-details',
      '.jobs-description__content',
      '.jobs-box__html-content',
      '#jobDescriptionText',
      '[data-testid="job-description"]',
      '.styles_JDC__dang-inner-html__h0K4t',
      '[class*="job-description"]',
      '[class*="description"]',
    ]) ||
    selectedText ||
    meta('description')

  return {
    title: cleanTitle(title),
    company: cleanText(company, 180),
    location: cleanText(location, 180),
    description: cleanText(description, 20000),
    applyUrl: window.location.href,
    sourcePlatform: sourcePlatform(),
  }
}

function firstText(selectors) {
  for (const selector of selectors) {
    const values = Array.from(document.querySelectorAll(selector))
      .map((element) => cleanText(element.innerText || element.textContent || '', 5000))
      .filter(Boolean)
    if (values[0]) return values[0]
  }
  return ''
}

function meta(name) {
  const element = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)
  return cleanText(element?.getAttribute('content') || '', 1000)
}

function cleanTitle(value) {
  return cleanText(value, 240)
    .replace(/\s+\|\s+LinkedIn.*$/i, '')
    .replace(/\s+-\s+Indeed.*$/i, '')
    .replace(/\s+-\s+Naukri.*$/i, '')
}

function cleanText(value, maxLength) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function sourcePlatform() {
  const host = window.location.hostname.toLowerCase()
  if (host.includes('linkedin')) return 'LinkedIn Capture'
  if (host.includes('indeed')) return 'Indeed Capture'
  if (host.includes('naukri')) return 'Naukri Capture'
  return `${host.replace(/^www\./, '')} Capture`
}

function setStatus(message, tone) {
  const status = document.getElementById(STATUS_ID)
  if (!status) return
  status.textContent = message
  status.dataset.tone = tone
}
})()
