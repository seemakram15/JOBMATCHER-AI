import type { IncomingMessage, ServerResponse } from 'node:http'
import { z } from 'zod'
import { fetchLiveJobs } from '../src/lib/liveJobs.js'
import {
  enforceRateLimit,
  handleOptions,
  parseSearchParams,
  requireMethod,
  sendError,
  sendJson,
  setCors,
} from './security.js'

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
  targetRoles: z.string().trim().max(500, 'Target roles list is too long.').optional().default(''),
  mustHaveSkills: z.string().trim().max(700, 'Must-have skills list is too long.').optional().default(''),
  avoidKeywords: z.string().trim().max(700, 'Avoid keywords list is too long.').optional().default(''),
  preferredCountries: z.string().trim().max(400, 'Preferred countries list is too long.').optional().default(''),
  preferredCities: z.string().trim().max(500, 'Preferred cities list is too long.').optional().default(''),
  remotePreference: z.enum(['remote', 'hybrid', 'onsite', 'any']).optional().default('remote'),
  minimumSalary: z.coerce.number().min(0).max(1_000_000).optional().default(0),
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
    const targetRoles = cleanCsv(input.targetRoles, 12, 120)
    const mustHaveSkills = cleanCsv(input.mustHaveSkills, 30, 80)
    const avoidKeywords = cleanCsv(input.avoidKeywords, 30, 80)
    const preferredCountries = cleanCsv(input.preferredCountries, 8, 80)
    const preferredCities = cleanCsv(input.preferredCities, 12, 80)
    const result = await fetchLiveJobs({
      query: input.query || skills.join(' ') || 'software engineer',
      location: input.location,
      skills,
      targetRoles,
      mustHaveSkills,
      avoidKeywords,
      preferredCountries,
      preferredCities,
      remotePreference: input.remotePreference,
      minimumSalary: input.minimumSalary,
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

function cleanCsv(value: string, limit: number, maxLength: number) {
  const seen = new Set<string>()
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length <= maxLength)
    .filter((item) => /^[\w\s+#./&()-]{1,160}$/.test(item))
    .filter((item) => {
      const key = item.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, limit)
}
