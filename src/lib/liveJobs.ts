import fetch from 'node-fetch'
import type { ExperienceLevel, Job, JobType, SkillRequirement, WorkMode } from '../types'

export interface LiveJobSearchInput {
  query: string
  location?: string
  skills?: string[]
  experienceYears?: number
  limit?: number
}

export interface LiveJobSearchResult {
  jobs: Job[]
  sources: {
    name: string
    count: number
    ok: boolean
    error?: string
  }[]
}

const skillHints = [
  'React',
  'TypeScript',
  'JavaScript',
  'Node.js',
  'Python',
  'Django',
  'FastAPI',
  'PHP',
  'Laravel',
  'Vue',
  'Angular',
  'Next.js',
  'GraphQL',
  'REST APIs',
  'PostgreSQL',
  'MySQL',
  'MongoDB',
  'Redis',
  'AWS',
  'Docker',
  'Kubernetes',
  'Terraform',
  'Tailwind',
  'Vite',
  'Jest',
  'Playwright',
  'Cypress',
  'Machine Learning',
  'Data Analysis',
  'Figma',
]

export async function fetchLiveJobs(input: LiveJobSearchInput, env: Record<string, string | undefined> = process.env) {
  const query = input.query.trim() || input.skills?.slice(0, 4).join(' ') || 'software engineer'
  const sources = await Promise.allSettled([
    fetchRemotiveJobs(query),
    fetchRemoteOkJobs(query),
    fetchSerpApiJobs(query, input.location || 'Remote', env.SERPAPI_KEY),
  ])

  const result: LiveJobSearchResult = {
    jobs: [],
    sources: [],
  }

  for (const [index, sourceResult] of sources.entries()) {
    const sourceName = ['Remotive', 'RemoteOK', 'Google Jobs'][index]
    if (sourceResult.status === 'fulfilled') {
      result.jobs.push(...sourceResult.value)
      result.sources.push({ name: sourceName, count: sourceResult.value.length, ok: true })
    } else {
      result.sources.push({ name: sourceName, count: 0, ok: false, error: sourceResult.reason?.message || 'failed' })
    }
  }

  const deduped = dedupeJobs(result.jobs)
  result.jobs = deduped
    .filter((job) => matchesQuery(job, query, input.skills || []))
    .sort((a, b) => +new Date(b.postedAt) - +new Date(a.postedAt))
    .slice(0, input.limit || 60)

  return result
}

async function fetchRemotiveJobs(query: string): Promise<Job[]> {
  const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}`
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Remotive HTTP ${response.status}`)
  const data = (await response.json()) as {
    jobs?: Array<{
      id: number
      title: string
      company_name: string
      candidate_required_location?: string
      job_type?: string
      salary?: string
      description?: string
      publication_date?: string
      url?: string
      tags?: string[]
      category?: string
    }>
  }

  return (data.jobs || []).map((item) => {
    const skills = inferSkills(`${item.title} ${item.category || ''} ${(item.tags || []).join(' ')} ${stripHtml(item.description || '')}`)
    const salary = parseSalary(item.salary || '')
    return {
      id: uuidFromText(`remotive-${item.id}`),
      title: item.title,
      company: item.company_name,
      companyLogo: initials(item.company_name),
      location: item.candidate_required_location || 'Remote',
      country: 'Remote',
      city: 'Remote',
      isRemote: true,
      workMode: 'remote',
      description: stripHtml(item.description || ''),
      descriptionHtml: item.description || '',
      salaryMin: salary.min,
      salaryMax: salary.max,
      salaryCurrency: 'USD',
      jobType: normaliseJobType(item.job_type),
      experienceMin: inferExperienceMin(`${item.title} ${item.description || ''}`),
      experienceMax: inferExperienceMax(`${item.title} ${item.description || ''}`),
      level: inferLevel(`${item.title} ${item.description || ''}`),
      skillsRequired: skills,
      applyUrl: item.url || 'https://remotive.com',
      sourcePlatform: 'Remotive',
      postedAt: item.publication_date || new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
    }
  })
}

async function fetchRemoteOkJobs(query: string): Promise<Job[]> {
  const response = await fetch('https://remoteok.com/api', {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Jobmatcher local job search',
    },
  })
  if (!response.ok) throw new Error(`RemoteOK HTTP ${response.status}`)
  const data = (await response.json()) as Array<{
    id?: number | string
    position?: string
    company?: string
    location?: string
    description?: string
    tags?: string[]
    url?: string
    salary_min?: number
    salary_max?: number
    date?: string
  }>

  return data
    .filter((item) => item.position && item.company)
    .filter((item) => matchesText(`${item.position} ${item.company} ${(item.tags || []).join(' ')} ${item.description || ''}`, query))
    .map((item) => {
      const skills = inferSkills(`${item.position} ${(item.tags || []).join(' ')} ${stripHtml(item.description || '')}`)
      return {
        id: uuidFromText(`remoteok-${item.id || hash(`${item.company}-${item.position}`)}`),
        title: item.position || 'Untitled role',
        company: item.company || 'Unknown company',
        companyLogo: initials(item.company || 'RemoteOK'),
        location: item.location || 'Remote',
        country: 'Remote',
        city: 'Remote',
        isRemote: true,
        workMode: 'remote',
        description: stripHtml(item.description || ''),
        descriptionHtml: item.description || '',
        salaryMin: item.salary_min || undefined,
        salaryMax: item.salary_max || undefined,
        salaryCurrency: 'USD',
        jobType: 'full_time',
        experienceMin: inferExperienceMin(`${item.position} ${item.description || ''}`),
        experienceMax: inferExperienceMax(`${item.position} ${item.description || ''}`),
        level: inferLevel(`${item.position} ${item.description || ''}`),
        skillsRequired: skills,
        applyUrl: item.url || 'https://remoteok.com',
        sourcePlatform: 'RemoteOK',
        postedAt: item.date || new Date().toISOString(),
        fetchedAt: new Date().toISOString(),
      }
    })
}

async function fetchSerpApiJobs(query: string, location: string, apiKey?: string): Promise<Job[]> {
  if (!apiKey) return []
  const isRemoteSearch = /^remote$/i.test(location)
  const serpLocation = isRemoteSearch ? 'United States' : location
  const url = new URL('https://serpapi.com/search.json')
  url.searchParams.set('engine', 'google_jobs')
  url.searchParams.set('q', isRemoteSearch ? `${query} remote` : query)
  url.searchParams.set('location', serpLocation || 'United States')
  url.searchParams.set('api_key', apiKey)

  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`SerpAPI HTTP ${response.status}`)
  const data = (await response.json()) as {
    jobs_results?: Array<{
      job_id?: string
      title?: string
      company_name?: string
      location?: string
      description?: string
      via?: string
      related_links?: { link?: string }[]
      detected_extensions?: {
        posted_at?: string
        salary?: string
        schedule_type?: string
      }
    }>
  }

  return (data.jobs_results || []).map((item) => {
    const description = item.description || ''
    const skills = inferSkills(`${item.title || ''} ${description}`)
    const salary = parseSalary(item.detected_extensions?.salary || '')
    return {
      id: uuidFromText(`serpapi-${item.job_id || hash(`${item.company_name}-${item.title}-${item.location}`)}`),
      title: item.title || 'Untitled role',
      company: item.company_name || 'Unknown company',
      companyLogo: initials(item.company_name || 'GJ'),
      location: item.location || location || 'Remote',
      country: item.location || location || 'Remote',
      city: item.location || location || 'Remote',
      isRemote: /remote/i.test(`${item.location} ${description}`),
      workMode: inferWorkMode(`${item.location} ${description}`),
      description,
      descriptionHtml: `<p>${escapeHtml(description).replace(/\n/g, '</p><p>')}</p>`,
      salaryMin: salary.min,
      salaryMax: salary.max,
      salaryCurrency: 'USD',
      jobType: normaliseJobType(item.detected_extensions?.schedule_type),
      experienceMin: inferExperienceMin(`${item.title} ${description}`),
      experienceMax: inferExperienceMax(`${item.title} ${description}`),
      level: inferLevel(`${item.title} ${description}`),
      skillsRequired: skills,
      applyUrl: item.related_links?.[0]?.link || 'https://jobs.google.com',
      sourcePlatform: item.via ? `Google Jobs (${item.via})` : 'Google Jobs',
      postedAt: normalisePostedAt(item.detected_extensions?.posted_at),
      fetchedAt: new Date().toISOString(),
    }
  })
}

function inferSkills(text: string): SkillRequirement[] {
  const found = skillHints
    .filter((skill) => matchesText(text, skill))
    .slice(0, 10)
    .map((skill) => ({ skill, required: true, weight: 1 }))

  return found.length ? found : [{ skill: 'Communication', required: true, weight: 0.5 }]
}

function matchesQuery(job: Job, query: string, skills: string[]) {
  const haystack = `${job.title} ${job.company} ${job.description} ${job.skillsRequired.map((skill) => skill.skill).join(' ')}`
  if (skills.some((skill) => matchesText(haystack, skill))) return true
  return matchesText(haystack, query)
}

function matchesText(text: string, query: string) {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((token) => token.length > 1)
    .slice(0, 8)

  const haystack = text.toLowerCase()
  return !tokens.length || tokens.some((token) => haystack.includes(token))
}

function dedupeJobs(jobs: Job[]) {
  const seen = new Set<string>()
  return jobs.filter((job) => {
    const key = `${job.title.toLowerCase()}::${job.company.toLowerCase()}::${job.location.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function normaliseJobType(value?: string): JobType {
  const text = (value || '').toLowerCase()
  if (text.includes('contract')) return 'contract'
  if (text.includes('part')) return 'part_time'
  if (text.includes('freelance')) return 'freelance'
  if (text.includes('intern')) return 'internship'
  return 'full_time'
}

function inferWorkMode(text: string): WorkMode {
  if (/remote/i.test(text)) return 'remote'
  if (/hybrid/i.test(text)) return 'hybrid'
  return 'onsite'
}

function inferLevel(text: string): ExperienceLevel {
  if (/principal|staff|lead|head of/i.test(text)) return 'lead'
  if (/senior|sr\.?/i.test(text)) return 'senior'
  if (/intern|graduate|junior|entry/i.test(text)) return 'entry'
  return 'mid'
}

function inferExperienceMin(text: string) {
  const match = text.match(/(\d+)\+?\s*(?:years|yrs)/i)
  return match ? Math.max(0, Number(match[1]) - 1) : undefined
}

function inferExperienceMax(text: string) {
  const match = text.match(/(\d+)\+?\s*(?:years|yrs)/i)
  return match ? Number(match[1]) + 2 : undefined
}

function parseSalary(text: string) {
  const numbers = [...text.matchAll(/(?:\$|usd\s*)?(\d{2,3})(?:,?000|k)/gi)]
    .map((match) => Number(match[1]) * 1000)
    .filter(Boolean)
  return {
    min: numbers[0],
    max: numbers[1] || numbers[0],
  }
}

function normalisePostedAt(value?: string) {
  if (!value) return new Date().toISOString()
  const lower = value.toLowerCase()
  const amount = Number(lower.match(/\d+/)?.[0] || '1')
  if (lower.includes('day')) return new Date(Date.now() - amount * 24 * 36e5).toISOString()
  if (lower.includes('hour')) return new Date(Date.now() - amount * 36e5).toISOString()
  if (lower.includes('week')) return new Date(Date.now() - amount * 7 * 24 * 36e5).toISOString()
  return new Date().toISOString()
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }
    return entities[char]
  })
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function hash(value: string) {
  let output = 0
  for (let index = 0; index < value.length; index += 1) {
    output = (output << 5) - output + value.charCodeAt(index)
    output |= 0
  }
  return Math.abs(output).toString(36)
}

function uuidFromText(value: string) {
  let hex = ''
  let seed = hash(value)
  while (hex.length < 32) {
    seed = hash(`${seed}:${value}:${hex.length}`)
    hex += Number.parseInt(seed, 36).toString(16).padStart(8, '0')
  }

  const chars = hex.slice(0, 32).split('')
  chars[12] = '5'
  chars[16] = ((Number.parseInt(chars[16], 16) & 0x3) | 0x8).toString(16)
  return `${chars.slice(0, 8).join('')}-${chars.slice(8, 12).join('')}-${chars
    .slice(12, 16)
    .join('')}-${chars.slice(16, 20).join('')}-${chars.slice(20, 32).join('')}`
}
