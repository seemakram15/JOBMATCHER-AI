const productionAppUrl = 'https://myjobmatcher.vercel.app'
const developmentAppUrl = 'http://localhost:3002'

export function getAppBaseUrl() {
  const configured = normaliseUrl(import.meta.env.VITE_APP_URL)
  if (import.meta.env.DEV) return developmentAppUrl
  if (configured && !isLocalhost(configured)) return configured
  return productionAppUrl
}

export function getPasswordRecoveryRedirectUrl() {
  return `${getAppBaseUrl()}/auth?mode=recovery`
}

function normaliseUrl(value: unknown) {
  if (!value || typeof value !== 'string') return ''
  const trimmed = value.trim().replace(/\/+$/, '')
  if (!trimmed || /dummy|placeholder/i.test(trimmed)) return ''
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    return url.toString().replace(/\/+$/, '')
  } catch {
    return ''
  }
}

function isLocalhost(value: string) {
  try {
    const url = new URL(value)
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)
  } catch {
    return false
  }
}
