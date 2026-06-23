import type { IncomingMessage, ServerResponse } from 'node:http'
import { fetchLiveJobs } from '../src/lib/liveJobs'

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  setCors(res)

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET.' } })
    return
  }

  try {
    const url = new URL(req.url || '/', 'http://localhost')
    const skills = (url.searchParams.get('skills') || '')
      .split(',')
      .map((skill) => skill.trim())
      .filter(Boolean)
    const result = await fetchLiveJobs({
      query: url.searchParams.get('query') || skills.join(' ') || 'software engineer',
      location: url.searchParams.get('location') || 'Remote',
      skills,
      experienceYears: Number(url.searchParams.get('experienceYears') || '0') || undefined,
      limit: Number(url.searchParams.get('limit') || '60'),
    })

    sendJson(res, 200, {
      jobs: result.jobs,
      sources: result.sources,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    sendJson(res, 500, {
      error: {
        code: 'LIVE_JOBS_FETCH_FAILED',
        message: error instanceof Error ? error.message : 'Unable to fetch live jobs.',
      },
    })
  }
}

function setCors(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}
