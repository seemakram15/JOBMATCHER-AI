import type { IncomingMessage, ServerResponse } from 'node:http'
import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  ApiError,
  enforceRateLimit,
  getServiceClient,
  handleOptions,
  readJson,
  requireAuthenticatedCaller,
  requireMethod,
  sendError,
  sendJson,
  setCors,
} from './security.js'

const capturedJobSchema = z.object({
  title: z.string().trim().min(1).max(240),
  company: z.string().trim().max(180).optional().default(''),
  location: z.string().trim().max(180).optional().default('Remote'),
  description: z.string().trim().max(20_000).optional().default(''),
  applyUrl: z
    .string()
    .trim()
    .url()
    .max(2_000)
    .refine((value) => /^https?:\/\//i.test(value), 'Job URL must start with http:// or https://.'),
  sourcePlatform: z.string().trim().max(120).optional().default('Browser Capture'),
})

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  setCors(req, res, ['POST'])
  if (handleOptions(req, res, ['POST'])) return

  try {
    requireMethod(req, ['POST'])
    const caller = await requireAuthenticatedCaller(req)
    enforceRateLimit(req, 'import-captured-job', 120, 60_000)

    const input = capturedJobSchema.parse(await readJson(req, 80_000))
    const now = new Date().toISOString()
    const client = getServiceClient()
    const applyUrl = new URL(input.applyUrl).toString()
    const jobId = uuidFromText(`captured-job:${applyUrl}`)
    const applicationId = randomUUID()
    const company = cleanText(input.company, 180) || 'Hiring company'
    const location = cleanText(input.location, 180) || 'Remote'
    const sourcePlatform = normaliseCapturedSource(input.sourcePlatform, applyUrl)
    const description = cleanText(input.description, 20_000) || `Captured ${input.title} role at ${company}.`
    const skillsRequired = inferCapturedSkills(`${input.title} ${company} ${description}`)

    const { data: activeCv } = await client
      .from('cvs')
      .select('id')
      .eq('user_id', caller.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    const { error: jobError } = await client.from('jobs').upsert(
      {
        id: jobId,
        title: cleanText(input.title, 240),
        company,
        company_logo: initials(company),
        location,
        country: countryFromLocation(location),
        city: cityFromLocation(location),
        is_remote: /\bremote|anywhere\b/i.test(location),
        work_mode: /\bremote|anywhere\b/i.test(location) ? 'remote' : 'onsite',
        description,
        description_html: `<p>${escapeHtml(description)}</p>`,
        salary_currency: 'USD',
        job_type: 'full_time',
        level: 'mid',
        skills_required: skillsRequired,
        apply_url: applyUrl,
        source_url: applyUrl,
        source_platform: sourcePlatform,
        external_id: `${sourcePlatform}:${applyUrl}`.slice(0, 500),
        dedup_hash: jobId,
        posted_at: now,
        fetched_at: now,
        last_seen_at: now,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    )
    if (jobError) throw new ApiError(500, 'JOB_CAPTURE_SAVE_FAILED', jobError.message)

    const { data: existingApplication, error: existingError } = await client
      .from('applications')
      .select('id, status')
      .eq('user_id', caller.id)
      .eq('job_id', jobId)
      .maybeSingle()
    if (existingError) throw new ApiError(500, 'JOB_CAPTURE_LOOKUP_FAILED', existingError.message)

    if (existingApplication) {
      sendJson(res, 200, {
        ok: true,
        duplicate: true,
        jobId,
        applicationId: existingApplication.id,
        status: existingApplication.status,
      })
      return
    }

    const { error: appError } = await client.from('applications').insert({
      id: applicationId,
      user_id: caller.id,
      job_id: jobId,
      cv_id: activeCv?.id || null,
      status: 'saved',
      notes: `Saved from ${sourcePlatform}.`,
      last_updated: now,
      created_at: now,
    })
    if (appError) throw new ApiError(500, 'JOB_CAPTURE_APPLICATION_FAILED', appError.message)

    await client.from('application_history').insert({
      application_id: applicationId,
      old_status: null,
      new_status: 'saved',
      note: `Saved from ${sourcePlatform} browser button.`,
      changed_at: now,
      changed_by: caller.id,
    })

    sendJson(res, 201, { ok: true, duplicate: false, jobId, applicationId, status: 'saved' })
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendJson(res, 400, {
        error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || 'Invalid captured job.' },
      })
      return
    }
    sendError(res, error, 'JOB_CAPTURE_FAILED')
  }
}

function uuidFromText(value: string) {
  const hash = createHash('sha256').update(value).digest('hex').slice(0, 32)
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`
}

function cleanText(value: unknown, maxLength: number) {
  return String(value || '')
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0)
      return code < 32 || code === 127 ? ' ' : char
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function normaliseCapturedSource(source: string, applyUrl: string) {
  const host = (() => {
    try {
      return new URL(applyUrl).hostname.toLowerCase()
    } catch {
      return source.toLowerCase()
    }
  })()
  if (host.includes('linkedin')) return 'LinkedIn Capture'
  if (host.includes('indeed')) return 'Indeed Capture'
  if (host.includes('naukri')) return 'Naukri Capture'
  if (host.includes('glassdoor')) return 'Glassdoor Capture'
  return `${cleanText(source, 80).replace(/^www\./, '') || 'Browser'} Capture`.slice(0, 120)
}

function inferCapturedSkills(text: string) {
  const hints = [
    'Ruby on Rails',
    'Ruby',
    'React',
    'TypeScript',
    'JavaScript',
    'Node.js',
    'Python',
    'PostgreSQL',
    'MySQL',
    'Redis',
    'GraphQL',
    'REST APIs',
    'AWS',
    'Docker',
    'Kubernetes',
    'Cypress',
    'Playwright',
  ]
  const haystack = text.toLowerCase()
  return hints
    .filter((skill) => haystack.includes(skill.toLowerCase().replace('.', '')) || haystack.includes(skill.toLowerCase()))
    .slice(0, 12)
    .map((skill) => ({ skill, required: true, weight: 1 }))
}

function countryFromLocation(location: string) {
  const parts = location.split(',').map((part) => part.trim()).filter(Boolean)
  return parts[parts.length - 1] || location || 'Remote'
}

function cityFromLocation(location: string) {
  return location.split(',').map((part) => part.trim()).filter(Boolean)[0] || location || 'Remote'
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 3)
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }
    return map[char] || char
  })
}
