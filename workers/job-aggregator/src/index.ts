import crypto from 'node:crypto'

export interface RawJob {
  title?: string
  company?: string
  location?: string
  workType?: string
  description?: string
  applyUrl?: string
  url?: string
  postedAt?: string
  salaryMin?: number
  salaryMax?: number
}

export interface NormalisedJob {
  title: string
  company: string
  location: string
  is_remote: boolean
  work_mode: 'remote' | 'hybrid' | 'onsite'
  description: string
  salary_min?: number
  salary_max?: number
  salary_currency: string
  apply_url: string
  source_platform: string
  posted_at: string
  dedup_hash: string
}

export function getApifyTokens(env = process.env) {
  const tokens = [
    ...(env.APIFY_API_KEYS || '')
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean),
    env.APIFY_API_TOKEN,
  ].filter((token): token is string => Boolean(token))

  return Array.from(new Set(tokens))
}

export async function withApifyTokenFallback<T>(
  run: (token: string, tokenIndex: number) => Promise<T>,
  env = process.env,
) {
  const tokens = getApifyTokens(env)
  if (!tokens.length) throw new Error('No Apify API token configured')

  const failures: string[] = []
  for (const [index, token] of tokens.entries()) {
    try {
      return await run(token, index)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`token_${index + 1}: ${message}`)
      const shouldTryNext =
        /quota|credit|limit|payment|required|insufficient|429|402/i.test(message) && index < tokens.length - 1
      if (!shouldTryNext) throw error
    }
  }

  throw new Error(`All Apify tokens failed: ${failures.join('; ')}`)
}

const inferWorkMode = (location = '', workType = ''): NormalisedJob['work_mode'] => {
  const haystack = `${location} ${workType}`.toLowerCase()
  if (haystack.includes('remote')) return 'remote'
  if (haystack.includes('hybrid')) return 'hybrid'
  return 'onsite'
}

export function createDedupHash(job: Pick<NormalisedJob, 'title' | 'company' | 'location' | 'posted_at'>) {
  return crypto
    .createHash('sha256')
    .update(`${job.title}::${job.company}::${job.location}::${job.posted_at.slice(0, 10)}`)
    .digest('hex')
}

export function normaliseJob(raw: RawJob, sourcePlatform: string): NormalisedJob {
  const workMode = inferWorkMode(raw.location, raw.workType)
  const job = {
    title: raw.title?.trim() || 'Untitled role',
    company: raw.company?.trim() || 'Unknown company',
    location: raw.location?.trim() || 'Remote',
    is_remote: workMode === 'remote',
    work_mode: workMode,
    description: raw.description || '',
    salary_min: raw.salaryMin,
    salary_max: raw.salaryMax,
    salary_currency: 'USD',
    apply_url: raw.applyUrl || raw.url || '',
    source_platform: sourcePlatform,
    posted_at: raw.postedAt ? new Date(raw.postedAt).toISOString() : new Date().toISOString(),
  }

  return {
    ...job,
    dedup_hash: createDedupHash(job),
  }
}

export async function runAggregator() {
  const tokens = getApifyTokens()
  return {
    status: 'ready',
    tokenConfigured: tokens.length > 0,
    tokenFallbacks: tokens.length,
    sources: ['LinkedIn', 'Indeed', 'RemoteOK', 'Remotive', 'We Work Remotely'],
  }
}
