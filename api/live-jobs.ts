import type { IncomingMessage, ServerResponse } from 'node:http'
import { z } from 'zod'
import { fetchLiveJobs } from '../src/lib/liveJobs'
import {
  enforceRateLimit,
  handleOptions,
  parseSearchParams,
  requireMethod,
  sendError,
  sendJson,
  setCors,
} from './security'

const liveJobsQuerySchema = z.object({
  query: z
    .string()
    .trim()
    .max(120, 'Search query is too long.')
    .regex(/^[\w\s+#.,/&()-]*$/, 'Search query contains unsupported characters.')
    .optional()
    .default('software engineer'),
  location: z
    .string()
    .trim()
    .max(100, 'Location is too long.')
    .regex(/^[\w\s,.() -]*$/, 'Location contains unsupported characters.')
    .optional()
    .default('Remote'),
  skills: z
    .string()
    .trim()
    .max(500, 'Skills list is too long.')
    .optional()
    .default(''),
  experienceYears: z.coerce.number().min(0).max(60).optional(),
  limit: z.coerce.number().int().min(1).max(60).optional().default(60),
})

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  setCors(req, res, ['GET'])
  if (handleOptions(req, res, ['GET'])) return

  try {
    requireMethod(req, ['GET'])
    enforceRateLimit(req, 'live-jobs', 30, 60_000)
    const input = parseSearchParams(req, liveJobsQuerySchema)
    const skills = input.skills
      .split(',')
      .map((skill) => skill.trim())
      .filter((skill) => /^[\w\s+#./-]{1,50}$/.test(skill))
      .slice(0, 20)
      .filter(Boolean)
    const result = await fetchLiveJobs({
      query: input.query || skills.join(' ') || 'software engineer',
      location: input.location,
      skills,
      experienceYears: input.experienceYears,
      limit: input.limit,
    })

    sendJson(res, 200, {
      jobs: result.jobs,
      sources: result.sources,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    sendError(res, error, 'LIVE_JOBS_FETCH_FAILED')
  }
}
