import type { IncomingMessage, ServerResponse } from 'node:http'
import { z } from 'zod'
import { sanitiseJob } from '../src/lib/security.js'
import type { Job } from '../src/types.js'
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

const skillSchema = z.object({
  skill: z.string().max(80),
  required: z.boolean().optional(),
  weight: z.number().min(0).max(5).optional(),
})

const jobSchema = z.object({
  id: z.string().uuid(),
  title: z.string().max(240),
  company: z.string().max(180),
  companyLogo: z.string().max(40).optional(),
  location: z.string().max(180),
  country: z.string().max(120),
  city: z.string().max(120),
  isRemote: z.boolean(),
  workMode: z.enum(['remote', 'hybrid', 'onsite']),
  description: z.string().max(20_000),
  descriptionHtml: z.string().max(20_000).optional(),
  salaryMin: z.number().min(0).max(2_000_000).optional(),
  salaryMax: z.number().min(0).max(2_000_000).optional(),
  salaryCurrency: z.string().max(3),
  jobType: z.enum(['full_time', 'part_time', 'contract', 'freelance', 'internship']),
  experienceMin: z.number().min(0).max(60).optional(),
  experienceMax: z.number().min(0).max(60).optional(),
  level: z.enum(['entry', 'mid', 'senior', 'lead', 'executive']),
  skillsRequired: z.array(skillSchema).max(40),
  applyUrl: z.string().url().max(2_000),
  sourcePlatform: z.string().max(120),
  postedAt: z.string().max(40),
  fetchedAt: z.string().max(40),
})

const bodySchema = z.object({
  jobs: z.array(jobSchema).max(60),
})

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  setCors(req, res, ['POST'])
  if (handleOptions(req, res, ['POST'])) return

  try {
    requireMethod(req, ['POST'])
    await requireAuthenticatedCaller(req)
    enforceRateLimit(req, 'job-cache', 20, 60_000)

    const body = bodySchema.parse(await readJson(req, 1_500_000))
    const jobs = body.jobs.map((job) => sanitiseJob(job as Job)).filter((job) => job.title && job.applyUrl !== '#')
    if (!jobs.length) {
      sendJson(res, 200, { ok: true, count: 0 })
      return
    }

    const client = getServiceClient()
    const { error } = await client.from('jobs').upsert(
      jobs.map((job) => ({
        id: job.id,
        title: job.title,
        company: job.company,
        company_logo: job.companyLogo,
        location: job.location,
        country: job.country,
        city: job.city,
        is_remote: job.isRemote,
        work_mode: job.workMode,
        description: job.description,
        description_html: job.descriptionHtml,
        salary_min: job.salaryMin,
        salary_max: job.salaryMax,
        salary_currency: job.salaryCurrency,
        job_type: job.jobType,
        experience_min: job.experienceMin,
        experience_max: job.experienceMax,
        level: job.level,
        skills_required: job.skillsRequired,
        apply_url: job.applyUrl,
        source_url: job.applyUrl,
        source_platform: job.sourcePlatform,
        external_id: `${job.sourcePlatform}:${job.applyUrl}`,
        dedup_hash: job.id,
        posted_at: job.postedAt,
        fetched_at: job.fetchedAt,
        last_seen_at: new Date().toISOString(),
      })),
      { onConflict: 'id', ignoreDuplicates: true },
    )

    if (error) throw new ApiError(500, 'JOB_CACHE_WRITE_FAILED', error.message)
    sendJson(res, 200, { ok: true, count: jobs.length })
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendJson(res, 400, { error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || 'Invalid job payload.' } })
      return
    }
    sendError(res, error, 'JOB_CACHE_FAILED')
  }
}
