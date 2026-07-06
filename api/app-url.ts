import type { IncomingMessage } from 'node:http'

export const productionAppUrl = 'https://jobmatcher.qzz.io'
export const developmentAppUrl = 'http://localhost:3002'

interface AppBaseUrlInput {
  host?: string
  configuredUrl?: string
  nodeEnv?: string
}

export function getAppBaseUrl(req: IncomingMessage, env: NodeJS.ProcessEnv = process.env) {
  const forwardedHost = firstHeaderValue(req.headers['x-forwarded-host'])
  const host = forwardedHost || firstHeaderValue(req.headers.host)

  return resolveAppBaseUrl({
    host,
    configuredUrl: env.APP_URL || env.VITE_APP_URL,
    nodeEnv: env.NODE_ENV,
  })
}

export function resolveAppBaseUrl({ host, configuredUrl, nodeEnv }: AppBaseUrlInput = {}) {
  if (host && isLocalHostHeader(host)) return developmentAppUrl

  const configured = normaliseUrl(configuredUrl)
  if (configured && (nodeEnv !== 'production' || !isLocalhostUrl(configured))) return configured

  return nodeEnv === 'production' ? productionAppUrl : developmentAppUrl
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

function isLocalhostUrl(value: string) {
  try {
    return isLocalHostname(new URL(value).hostname)
  } catch {
    return false
  }
}

function isLocalHostHeader(host: string) {
  return isLocalHostname(host.split(':')[0])
}

function isLocalHostname(hostname: string) {
  return ['localhost', '127.0.0.1', '0.0.0.0'].includes(hostname)
}

function firstHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
