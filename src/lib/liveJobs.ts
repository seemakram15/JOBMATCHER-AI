import fetch from 'node-fetch'
import { sanitiseJob } from './security.js'
import type { ExperienceLevel, Job, JobType, RemotePreference, SkillRequirement, WorkMode } from '../types'

export interface LiveJobSearchInput {
  query: string
  location?: string
  skills?: string[]
  targetRoles?: string[]
  mustHaveSkills?: string[]
  avoidKeywords?: string[]
  preferredCountries?: string[]
  preferredCities?: string[]
  remotePreference?: RemotePreference
  minimumSalary?: number
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

interface SearchProfile {
  sourceQuery: string
  rawQuery: string
  strictRoleQuery: string
  roleTerms: string[]
  skillTerms: string[]
  mustHaveSkillTerms: string[]
  avoidTerms: string[]
  preferredCountries: string[]
  preferredCities: string[]
  remotePreference: RemotePreference
  minimumSalary: number
  coreSkillTerms: string[]
  secondarySkillTerms: string[]
  broadSkillTerms: string[]
  experienceYears?: number
}

interface SerpOrganicResult {
  title?: string
  link?: string
  snippet?: string
  source?: string
  displayed_link?: string
  rich_snippet?: {
    top?: {
      extensions?: string[]
      detected_extensions?: Record<string, unknown>
    }
  }
}

interface PlatformSearchTarget {
  name: string
  siteQuery: string
  resultLimit?: number
}

const skillHints = [
  'Ruby on Rails',
  'Ruby',
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

const mandatoryPlatformSearchTargets: PlatformSearchTarget[] = [
  {
    name: 'LinkedIn',
    siteQuery: '(site:linkedin.com/jobs OR site:www.linkedin.com/jobs OR site:linkedin.com/jobs/view)',
    resultLimit: 20,
  },
  {
    name: 'Indeed',
    siteQuery:
      '(site:indeed.com/viewjob OR site:indeed.com/jobs OR site:uk.indeed.com/viewjob OR site:in.indeed.com/viewjob OR site:pk.indeed.com/viewjob)',
    resultLimit: 20,
  },
  {
    name: 'Naukri',
    siteQuery: '(site:naukri.com/job-listings OR site:www.naukri.com/job-listings)',
    resultLimit: 20,
  },
]

const groupedPlatformSearchTargets: PlatformSearchTarget[] = [
  {
    name: 'Remote job boards',
    siteQuery:
      '(site:remotejobsfinder.co OR site:hubstafftalent.net/search/jobs OR site:jobspresso.co/remote-work OR site:remotive.com OR site:skipthedrive.com OR site:workew.com/remote-jobs OR site:dynamitejobs.com/remote-jobs)',
    resultLimit: 20,
  },
  {
    name: 'Career job boards',
    siteQuery:
      '(site:instahyre.com/job OR site:monster.com/job-openings OR site:monsterindia.com/job OR site:careercloud.com/jobs OR site:dice.com/job-detail OR site:careerbuilder.com/job OR site:jibberjobber.com/jobs OR site:glassdoor.com/job-listing)',
    resultLimit: 20,
  },
]

export async function fetchLiveJobs(input: LiveJobSearchInput, env: Record<string, string | undefined> = process.env) {
  const search = buildSearchProfile(input)
  const sourceTasks: Array<{ name: string; task: Promise<Job[]> }> = [
    { name: 'Remotive', task: fetchRemotiveJobs(search.sourceQuery) },
    { name: 'RemoteOK', task: fetchRemoteOkJobs(search.sourceQuery) },
    { name: 'Google Jobs', task: fetchSerpApiJobs(search.sourceQuery, input.location || 'Remote', env.SERPAPI_KEY) },
    { name: 'Google Career Pages', task: fetchSerpApiOrganicJobs(search, input, env.SERPAPI_KEY) },
    { name: 'Adzuna', task: fetchAdzunaJobs(search, input, env) },
    { name: 'Jooble', task: fetchJoobleJobs(search, input, env) },
    { name: 'OpenWeb Ninja', task: fetchOpenWebNinjaJobs(search, input, env) },
    { name: 'JSearch', task: fetchRapidApiJobs(search, input, env.RAPIDAPI_KEY, 'JSearch') },
    ...buildPlatformSourceTasks(search, input, env.SERPAPI_KEY),
  ]
  const sources = await Promise.allSettled(sourceTasks.map((source) => source.task))

  const result: LiveJobSearchResult = {
    jobs: [],
    sources: [],
  }

  for (const [index, sourceResult] of sources.entries()) {
    const sourceName = sourceTasks[index]?.name || 'Live source'
    if (sourceResult.status === 'fulfilled') {
      result.jobs.push(...sourceResult.value)
      result.sources.push({ name: sourceName, count: sourceResult.value.length, ok: true })
    } else {
      result.sources.push({ name: sourceName, count: 0, ok: false, error: safeSourceError(sourceResult.reason) })
    }
  }

  result.jobs = filterRelevantJobsForSearch(result.jobs, input)
    .slice(0, input.limit || 80)
    .map(sanitiseJob)

  return result
}

function safeSourceError(error: unknown) {
  const message = error instanceof Error ? error.message : 'failed'
  return message
    .replace(/https:\/\/jooble\.org\/api\/[^\s)]+/gi, 'https://jooble.org/api/<redacted>')
    .replace(/([?&](?:api_key|app_key|token|key)=)[^&\s)]+/gi, '$1<redacted>')
    .replace(/(X-RapidAPI-Key[:=]\s*)[^\s,)]+/gi, '$1<redacted>')
    .replace(/(X-API-Key[:=]\s*)[^\s,)]+/gi, '$1<redacted>')
    .slice(0, 240)
}

export function filterRelevantJobsForSearch(jobs: Job[], input: LiveJobSearchInput) {
  const search = buildSearchProfile(input)
  return dedupeJobs(jobs)
    .map((job) => ({ job, relevance: scoreJobRelevance(job, search) }))
    .filter(({ relevance }) => relevance.accept)
    .sort((a, b) => b.relevance.score - a.relevance.score || +new Date(b.job.postedAt) - +new Date(a.job.postedAt))
    .map(({ job }) => job)
}

export function explainLiveJobRelevance(job: Job, input: LiveJobSearchInput) {
  const search = buildSearchProfile(input)
  return {
    search,
    relevance: scoreJobRelevance(job, search),
  }
}

function buildSearchProfile(input: LiveJobSearchInput): SearchProfile {
  const targetRoles = dedupeTerms(input.targetRoles || [])
  const mustHaveSkills = dedupeTerms(input.mustHaveSkills || [])
  const skills = dedupeTerms([...mustHaveSkills, ...(input.skills || [])])
  const rawQuery = cleanSearchTerm(input.query)
  const roleSignal = targetRoles.length ? targetRoles.join(' ') : input.query
  const roleTerms = extractRoleTerms(roleSignal, skills)
  const coreSkillTerms = sortSkillsForSearch(skills.filter((skill) => isCoreSearchSkill(skill, rawQuery)))
  const broadSkillTerms = skills.filter((skill) => isBroadSearchSkill(skill, rawQuery))
  const secondarySkillTerms = sortSkillsForSearch(
    skills.filter((skill) => !coreSkillTerms.includes(skill) && !broadSkillTerms.includes(skill)),
  )
  const roleQuery = buildRoleQuery(targetRoles, roleTerms, rawQuery)
  const strongestSkills = buildSourceSkillTerms(mustHaveSkills, coreSkillTerms, secondarySkillTerms)
  const strictRoleQuery = buildStrictRoleQuery(targetRoles, roleTerms, rawQuery)

  return {
    sourceQuery: [roleQuery || strictRoleQuery, ...strongestSkills.slice(0, 4)].filter(Boolean).join(' '),
    rawQuery,
    strictRoleQuery,
    roleTerms,
    skillTerms: skills,
    mustHaveSkillTerms: mustHaveSkills,
    avoidTerms: dedupeTerms(input.avoidKeywords || []).filter((term) => !isEmptyPreference(term)),
    preferredCountries: dedupeTerms(input.preferredCountries || []),
    preferredCities: dedupeTerms(input.preferredCities || []),
    remotePreference: normaliseRemotePreference(input.remotePreference),
    minimumSalary: Math.max(0, Number(input.minimumSalary) || 0),
    coreSkillTerms,
    secondarySkillTerms,
    broadSkillTerms,
    experienceYears: input.experienceYears,
  }
}

function buildRoleQuery(targetRoles: string[], roleTerms: string[], rawQuery: string) {
  if (targetRoles.length) return targetRoles[0]
  if (roleTerms.length) return roleTerms.join(' ')
  if (hasRoleLanguage(rawQuery)) return rawQuery
  return ''
}

function buildSourceSkillTerms(mustHaveSkills: string[], coreSkillTerms: string[], secondarySkillTerms: string[]) {
  const supportSkills = [...coreSkillTerms, ...secondarySkillTerms].filter(
    (skill) => !mustHaveSkills.some((mustHave) => skillsEquivalent(skill, mustHave)),
  )
  return dedupeTerms([...mustHaveSkills.slice(0, 3), ...supportSkills.slice(0, 4)])
}

function buildStrictRoleQuery(targetRoles: string[], roleTerms: string[], rawQuery: string) {
  if (targetRoles.length) return targetRoles[0]
  const cleaned = cleanSearchTerm(rawQuery)
    .split(/\s+/)
    .filter((term) => !genericRoleTerms.has(term.toLowerCase()))
    .join(' ')
  if (cleaned) return cleaned
  return roleTerms.join(' ')
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

async function fetchSerpApiOrganicJobs(
  search: SearchProfile,
  input: LiveJobSearchInput,
  apiKey?: string,
): Promise<Job[]> {
  if (!apiKey) return []

  const location = providerLocation(input.location, search)
  const organicResults = await fetchSerpApiOrganicResults(
    buildGoogleCareerSearchQuery(search, location),
    location,
    apiKey,
    20,
  )

  return organicResults
    .filter((item) => item.title && item.link)
    .filter((item) => looksLikeJobSearchResult(item.title || '', item.link || '', item.snippet || '', search))
    .map((item) => mapSerpOrganicResultToJob(item, search, location, `Google Web (${hostFromUrl(item.link || '')})`))
}

function buildPlatformSourceTasks(search: SearchProfile, input: LiveJobSearchInput, apiKey?: string) {
  if (!apiKey) return []
  return [...mandatoryPlatformSearchTargets, ...groupedPlatformSearchTargets].map((target) => ({
    name: target.name,
    task: fetchSerpApiPlatformJobs(search, input, apiKey, target),
  }))
}

async function fetchSerpApiPlatformJobs(
  search: SearchProfile,
  input: LiveJobSearchInput,
  apiKey: string,
  target: PlatformSearchTarget,
): Promise<Job[]> {
  const location = providerLocation(input.location, search)
  const organicResults = await fetchSerpApiOrganicResults(
    buildPlatformSearchQuery(search, location, target.siteQuery),
    location,
    apiKey,
    target.resultLimit || 10,
  )

  return organicResults
    .filter((item) => item.title && item.link)
    .filter((item) => looksLikeJobSearchResult(item.title || '', item.link || '', item.snippet || '', search))
    .map((item) => mapSerpOrganicResultToJob(item, search, location, target.name))
}

async function fetchSerpApiOrganicResults(
  query: string,
  location: string,
  apiKey: string,
  limit: number,
): Promise<SerpOrganicResult[]> {
  const url = new URL('https://serpapi.com/search.json')
  url.searchParams.set('engine', 'google')
  url.searchParams.set('q', query)
  url.searchParams.set('num', String(Math.max(1, Math.min(20, limit))))
  url.searchParams.set('api_key', apiKey)
  if (!/^remote$/i.test(location)) url.searchParams.set('location', location)

  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`SerpAPI organic HTTP ${response.status}`)
  const data = (await response.json()) as { organic_results?: SerpOrganicResult[] }
  return data.organic_results || []
}

function mapSerpOrganicResultToJob(
  item: SerpOrganicResult,
  search: SearchProfile,
  location: string,
  sourcePlatform: string,
): Job {
  const link = item.link || ''
  const snippet = item.snippet || ''
  const host = hostFromUrl(link)
  const parsed = parseOrganicTitle(item.title || '', item.source || host, search)
  const text = `${parsed.title} ${parsed.company} ${snippet}`
  const salary = parseSalary(snippet)
  const inferredSkills = inferSkills(text)
  const skills = inferredSkills.length
    ? inferredSkills
    : search.mustHaveSkillTerms
        .filter((skill) => phraseMatches(normaliseForMatch(text), skill))
        .slice(0, 8)
        .map((skill) => ({ skill, required: true, weight: 1 }))
  const inferredLocation = inferOrganicLocation(snippet, location)

  return {
    id: uuidFromText(`google-web-${link}`),
    title: parsed.title,
    company: parsed.company,
    companyLogo: initials(parsed.company || host || 'GW'),
    location: inferredLocation,
    country: countryFromLocation(inferredLocation),
    city: cityFromLocation(inferredLocation),
    isRemote: /remote/i.test(`${parsed.title} ${snippet} ${location}`),
    workMode: inferWorkMode(`${parsed.title} ${snippet} ${location}`),
    description: snippet || `Public job result discovered from ${host}.`,
    descriptionHtml: `<p>${escapeHtml(snippet || `Public job result discovered from ${host}.`)}</p>`,
    salaryMin: salary.min,
    salaryMax: salary.max,
    salaryCurrency: 'USD',
    jobType: normaliseJobType(`${parsed.title} ${snippet}`),
    experienceMin: inferExperienceMin(`${parsed.title} ${snippet}`),
    experienceMax: inferExperienceMax(`${parsed.title} ${snippet}`),
    level: inferLevel(`${parsed.title} ${snippet}`),
    skillsRequired: skills,
    applyUrl: link,
    sourcePlatform,
    postedAt: normalisePostedAt(item.rich_snippet?.top?.extensions?.join(' ') || snippet),
    fetchedAt: new Date().toISOString(),
  }
}

function buildGoogleCareerSearchQuery(search: SearchProfile, location: string) {
  const role = search.strictRoleQuery || search.sourceQuery || search.rawQuery
  const rolePhrase = role.includes(' ') ? `"${role}"` : role
  const locationTerm = /^remote$/i.test(location) ? 'remote' : `"${location}"`
  const experienceTerms = buildExperienceSearchTerms(search.experienceYears)
  const platformTerms = '(job OR jobs OR careers OR hiring OR vacancy OR opening)'
  const sourceTerms =
    '(site:linkedin.com/jobs OR site:indeed.com OR site:naukri.com OR site:glassdoor.com OR site:dice.com OR site:greenhouse.io OR site:lever.co OR site:workable.com OR site:ashbyhq.com OR site:bamboohr.com OR site:smartrecruiters.com OR site:jobs.lever.co OR careers)'
  return [rolePhrase, platformTerms, experienceTerms, locationTerm, sourceTerms]
    .filter(Boolean)
    .join(' ')
    .slice(0, 480)
}

function buildPlatformSearchQuery(search: SearchProfile, location: string, siteQuery: string) {
  const role = search.strictRoleQuery || search.sourceQuery || search.rawQuery
  const rolePhrase = role.includes(' ') ? `"${role}"` : role
  const locationTerm = /^remote$/i.test(location) ? '(remote OR anywhere)' : `"${location}"`
  const experienceTerms = buildExperienceSearchTerms(search.experienceYears)
  const mustHaveTerms = search.mustHaveSkillTerms
    .slice(0, 3)
    .map((skill) => (skill.includes(' ') ? `"${skill}"` : skill))
    .join(' ')
  return [rolePhrase, mustHaveTerms, '(job OR jobs OR hiring OR opening OR vacancy)', experienceTerms, locationTerm, siteQuery]
    .filter(Boolean)
    .join(' ')
    .slice(0, 520)
}

function buildExperienceSearchTerms(experienceYears?: number) {
  if (!experienceYears || experienceYears <= 0) return ''
  const lower = Math.max(0, Math.floor(experienceYears) - 3)
  const upper = Math.floor(experienceYears)
  const years = Array.from({ length: upper - lower + 1 }, (_, index) => lower + index).filter((year) => year > 0)
  if (!years.length) return ''
  return `(${years.map((year) => `"${year}+ years" OR "${year} years"`).join(' OR ')} OR senior)`
}

function looksLikeJobSearchResult(title: string, link: string, snippet: string, search: SearchProfile) {
  const host = hostFromUrl(link)
  const signal = normaliseForMatch(`${title} ${snippet} ${host}`)
  const careerUrl = /\/(jobs?|careers?|positions?|openings?|vacanc|job-detail|job_boards|postings|recruiting|apply)\b/i.test(link)
  const knownJobHost =
    /(linkedin|indeed|naukri|instahyre|monster|careercloud|dice|careerbuilder|jibberjobber|glassdoor|remotejobsfinder|hubstafftalent|jobspresso|remotive|skipthedrive|workew|dynamitejobs|greenhouse|lever|workable|ashbyhq|bamboohr|smartrecruiters|wellfound|otta|remoteok)/i.test(
      host,
    )
  return (
    (careerUrl || knownJobHost || /\b(job|jobs|careers|hiring|vacancy|opening|apply)\b/i.test(signal)) &&
    resultMatchesRoleOrStrongSkills(title, snippet, search)
  )
}

function parseOrganicTitle(title: string, fallbackCompany: string, search: SearchProfile) {
  const cleaned = title
    .replace(
      /\s+[-|–—]\s+(LinkedIn|Indeed|Naukri|Instahyre|Monster|CareerCloud|Dice|CareerBuilder|JibberJobber|Glassdoor|RemoteJobsFinder|Hubstaff|Jobspresso|Remotive|SkipTheDrive|Workew|Dynamite Jobs|Wellfound|Greenhouse|Lever|Workable|Ashby|SmartRecruiters).*$/i,
      '',
    )
    .replace(
      /\s+\|\s+(LinkedIn|Indeed|Naukri|Instahyre|Monster|CareerCloud|Dice|CareerBuilder|JibberJobber|Glassdoor|RemoteJobsFinder|Hubstaff|Jobspresso|Remotive|SkipTheDrive|Workew|Dynamite Jobs|Wellfound|Greenhouse|Lever|Workable|Ashby|SmartRecruiters).*$/i,
      '',
    )
    .trim()
  const parts = cleaned.split(/\s+(?:[-|–—]|\|)\s+/).map((part) => part.trim()).filter(Boolean)
  const rolePart = parts.find((part) => titleMatchesRole(part, search)) || parts[0] || cleaned
  const companyPart = parts.find((part) => part !== rolePart && !/\b(job|jobs|careers|hiring|apply)\b/i.test(part)) || fallbackCompany

  return {
    title: rolePart.slice(0, 180),
    company: companyPart.slice(0, 120) || fallbackCompany || 'Hiring company',
  }
}

function inferOrganicLocation(snippet: string, fallback: string) {
  const remoteMatch = snippet.match(/\bremote\b/i)
  if (remoteMatch) return 'Remote'
  const locationMatch = snippet.match(/\b(?:in|location:)\s+([A-Z][A-Za-z .'-]+(?:,\s*[A-Z][A-Za-z .'-]+)?)/)
  return locationMatch?.[1]?.slice(0, 120) || fallback || 'Remote'
}

async function fetchAdzunaJobs(
  search: SearchProfile,
  input: LiveJobSearchInput,
  env: Record<string, string | undefined>,
): Promise<Job[]> {
  const appId = env.ADZUNA_APP_ID
  const keys = getEnvList(env, 'ADZUNA_APP_KEYS', ['ADZUNA_APP_KEY'])
  if (!appId || !keys.length) return []

  const country = adzunaCountryCode(input.location, search.preferredCountries)
  const where = providerLocation(input.location, search)
  const errors: string[] = []

  for (const key of keys) {
    const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`)
    url.searchParams.set('app_id', appId)
    url.searchParams.set('app_key', key)
    url.searchParams.set('results_per_page', '50')
    url.searchParams.set('sort_by', 'date')
    url.searchParams.set('what', search.sourceQuery)
    if (where && !/^remote$/i.test(where)) url.searchParams.set('where', where)

    try {
      const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = (await response.json()) as {
        results?: Array<{
          id?: string
          title?: string
          description?: string
          redirect_url?: string
          created?: string
          salary_min?: number
          salary_max?: number
          contract_time?: string
          category?: { label?: string }
          company?: { display_name?: string }
          location?: { display_name?: string; area?: string[] }
        }>
      }

      return (data.results || []).map((item) => {
        const description = stripHtml(item.description || '')
        const location = item.location?.display_name || where || 'Remote'
        const skills = inferSkills(`${item.title || ''} ${description} ${item.category?.label || ''}`)
        return {
          id: uuidFromText(`adzuna-${country}-${item.id || hash(`${item.company?.display_name}-${item.title}-${location}`)}`),
          title: item.title || 'Untitled role',
          company: item.company?.display_name || 'Unknown company',
          companyLogo: initials(item.company?.display_name || 'AZ'),
          location,
          country: item.location?.area?.[0] || country.toUpperCase(),
          city: lastArrayItem(item.location?.area) || location,
          isRemote: /remote/i.test(`${location} ${description}`),
          workMode: inferWorkMode(`${location} ${description}`),
          description,
          descriptionHtml: `<p>${escapeHtml(description).replace(/\n/g, '</p><p>')}</p>`,
          salaryMin: item.salary_min || undefined,
          salaryMax: item.salary_max || undefined,
          salaryCurrency: currencyForCountry(country),
          jobType: normaliseJobType(item.contract_time),
          experienceMin: inferExperienceMin(`${item.title} ${description}`),
          experienceMax: inferExperienceMax(`${item.title} ${description}`),
          level: inferLevel(`${item.title} ${description}`),
          skillsRequired: skills,
          applyUrl: item.redirect_url || 'https://www.adzuna.com',
          sourcePlatform: 'Adzuna',
          postedAt: item.created || new Date().toISOString(),
          fetchedAt: new Date().toISOString(),
        }
      })
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'failed')
    }
  }

  throw new Error(`Adzuna failed after ${keys.length} key${keys.length === 1 ? '' : 's'}: ${errors[errors.length - 1] || 'unknown error'}`)
}

async function fetchJoobleJobs(
  search: SearchProfile,
  input: LiveJobSearchInput,
  env: Record<string, string | undefined>,
): Promise<Job[]> {
  const keys = getEnvList(env, 'JOOBLE_API_KEYS', ['JOOBLE_API_KEY'])
  if (!keys.length) return []

  const location = providerLocation(input.location, search)
  const errors: string[] = []
  for (const key of keys) {
    try {
      const response = await fetch(`https://jooble.org/api/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: search.sourceQuery,
          location: /^remote$/i.test(location) ? '' : location,
          page: 1,
        }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = (await response.json()) as {
        jobs?: Array<{
          title?: string
          company?: string
          location?: string
          snippet?: string
          salary?: string
          source?: string
          type?: string
          link?: string
          updated?: string
        }>
      }

      return (data.jobs || []).map((item) => {
        const description = stripHtml(item.snippet || '')
        const salary = parseSalary(item.salary || '')
        const jobLocation = item.location || location || 'Remote'
        return {
          id: uuidFromText(`jooble-${item.link || `${item.company}-${item.title}-${jobLocation}`}`),
          title: item.title || 'Untitled role',
          company: item.company || item.source || 'Unknown company',
          companyLogo: initials(item.company || item.source || 'JB'),
          location: jobLocation,
          country: countryFromLocation(jobLocation),
          city: cityFromLocation(jobLocation),
          isRemote: /remote/i.test(`${jobLocation} ${description}`),
          workMode: inferWorkMode(`${jobLocation} ${description}`),
          description,
          descriptionHtml: `<p>${escapeHtml(description).replace(/\n/g, '</p><p>')}</p>`,
          salaryMin: salary.min,
          salaryMax: salary.max,
          salaryCurrency: 'USD',
          jobType: normaliseJobType(item.type),
          experienceMin: inferExperienceMin(`${item.title} ${description}`),
          experienceMax: inferExperienceMax(`${item.title} ${description}`),
          level: inferLevel(`${item.title} ${description}`),
          skillsRequired: inferSkills(`${item.title || ''} ${description}`),
          applyUrl: item.link || 'https://jooble.org',
          sourcePlatform: 'Jooble',
          postedAt: item.updated || new Date().toISOString(),
          fetchedAt: new Date().toISOString(),
        }
      })
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'failed')
    }
  }

  throw new Error(`Jooble failed after ${keys.length} key${keys.length === 1 ? '' : 's'}: ${errors[errors.length - 1] || 'unknown error'}`)
}

async function fetchRapidApiJobs(
  search: SearchProfile,
  input: LiveJobSearchInput,
  apiKey: string | undefined,
  sourceName: string,
): Promise<Job[]> {
  if (!apiKey) return []

  const location = providerLocation(input.location, search)
  const query = /^remote$/i.test(location) ? `${search.sourceQuery} remote` : `${search.sourceQuery} in ${location}`
  const url = new URL('https://jsearch.p.rapidapi.com/search')
  url.searchParams.set('query', query)
  url.searchParams.set('num_pages', '1')
  url.searchParams.set('date_posted', 'month')
  url.searchParams.set('employment_types', 'FULLTIME,CONTRACTOR,PARTTIME,INTERN')

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
    },
  })
  if (!response.ok) throw new Error(`JSearch HTTP ${response.status}`)
  const data = (await response.json()) as {
    data?: Array<{
      job_id?: string
      employer_name?: string
      employer_logo?: string | null
      job_title?: string
      job_city?: string | null
      job_state?: string | null
      job_country?: string | null
      job_is_remote?: boolean
      job_description?: string
      job_apply_link?: string
      job_posted_at_datetime_utc?: string
      job_min_salary?: number | null
      job_max_salary?: number | null
      job_salary_currency?: string | null
      job_employment_type?: string | null
      job_required_skills?: string[] | null
      job_required_experience?: { required_experience_in_months?: number | null } | null
    }>
  }

  return (data.data || []).map((item) => {
    const description = item.job_description || ''
    const jobLocation = [item.job_city, item.job_state, item.job_country].filter(Boolean).join(', ') || (item.job_is_remote ? 'Remote' : location)
    const skills = (item.job_required_skills?.length ? item.job_required_skills : inferSkills(`${item.job_title || ''} ${description}`).map((skill) => skill.skill))
      .slice(0, 12)
      .map((skill) => ({ skill, required: true, weight: 1 }))
    const months = item.job_required_experience?.required_experience_in_months
    return {
      id: uuidFromText(`jsearch-${item.job_id || hash(`${item.employer_name}-${item.job_title}-${jobLocation}`)}`),
      title: item.job_title || 'Untitled role',
      company: item.employer_name || 'Unknown company',
      companyLogo: initials(item.employer_name || 'JS'),
      location: jobLocation,
      country: item.job_country || countryFromLocation(jobLocation),
      city: item.job_city || cityFromLocation(jobLocation),
      isRemote: Boolean(item.job_is_remote) || /remote/i.test(`${jobLocation} ${description}`),
      workMode: item.job_is_remote ? 'remote' : inferWorkMode(`${jobLocation} ${description}`),
      description,
      descriptionHtml: `<p>${escapeHtml(description).replace(/\n/g, '</p><p>')}</p>`,
      salaryMin: item.job_min_salary || undefined,
      salaryMax: item.job_max_salary || undefined,
      salaryCurrency: item.job_salary_currency || 'USD',
      jobType: normaliseJobType(item.job_employment_type || undefined),
      experienceMin: months ? Math.floor(months / 12) : inferExperienceMin(`${item.job_title} ${description}`),
      experienceMax: months ? Math.ceil(months / 12) + 2 : inferExperienceMax(`${item.job_title} ${description}`),
      level: inferLevel(`${item.job_title} ${description}`),
      skillsRequired: skills,
      applyUrl: item.job_apply_link || 'https://www.google.com/search?q=jobs',
      sourcePlatform: sourceName,
      postedAt: item.job_posted_at_datetime_utc || new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
    }
  })
}

async function fetchOpenWebNinjaJobs(
  search: SearchProfile,
  input: LiveJobSearchInput,
  env: Record<string, string | undefined>,
): Promise<Job[]> {
  const apiKey = env.OPENWEB_NINJA_API_KEY
  if (!apiKey) return []

  const location = providerLocation(input.location, search)
  const url = new URL('https://api.openwebninja.com/jsearch/search-v2')
  url.searchParams.set('query', /^remote$/i.test(location) ? `${search.sourceQuery} remote` : `${search.sourceQuery} in ${location}`)
  url.searchParams.set('country', openWebCountryCode(input.location, search.preferredCountries))
  url.searchParams.set('language', 'en')
  url.searchParams.set('page', '1')
  url.searchParams.set('num_pages', '1')
  url.searchParams.set('date_posted', 'month')
  if (search.remotePreference === 'remote') url.searchParams.set('work_from_home', 'true')

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'x-api-key': apiKey,
    },
  })
  if (!response.ok) throw new Error(`OpenWeb Ninja HTTP ${response.status}`)
  const data = (await response.json()) as {
    data?: Array<{
      job_id?: string
      employer_name?: string
      job_title?: string
      job_city?: string | null
      job_state?: string | null
      job_country?: string | null
      job_is_remote?: boolean
      job_description?: string
      job_apply_link?: string
      job_posted_at_datetime_utc?: string
      job_min_salary?: number | null
      job_max_salary?: number | null
      job_salary_currency?: string | null
      job_employment_type?: string | null
      job_required_skills?: string[] | null
      job_required_experience?: { required_experience_in_months?: number | null } | null
    }>
    jobs?: Array<{
      id?: string
      title?: string
      company?: string
      location?: string
      description?: string
      url?: string
      posted_at?: string
      salary_min?: number | null
      salary_max?: number | null
      skills?: string[] | null
    }>
  }

  if (data.data) return mapJSearchLikeJobs(data.data, location, 'OpenWeb Ninja')
  return (data.jobs || []).map((item) => {
    const description = item.description || ''
    const jobLocation = item.location || location
    return {
      id: uuidFromText(`openweb-${item.id || hash(`${item.company}-${item.title}-${jobLocation}`)}`),
      title: item.title || 'Untitled role',
      company: item.company || 'Unknown company',
      companyLogo: initials(item.company || 'OW'),
      location: jobLocation,
      country: countryFromLocation(jobLocation),
      city: cityFromLocation(jobLocation),
      isRemote: /remote/i.test(`${jobLocation} ${description}`),
      workMode: inferWorkMode(`${jobLocation} ${description}`),
      description,
      descriptionHtml: `<p>${escapeHtml(description).replace(/\n/g, '</p><p>')}</p>`,
      salaryMin: item.salary_min || undefined,
      salaryMax: item.salary_max || undefined,
      salaryCurrency: 'USD',
      jobType: 'full_time',
      experienceMin: inferExperienceMin(`${item.title} ${description}`),
      experienceMax: inferExperienceMax(`${item.title} ${description}`),
      level: inferLevel(`${item.title} ${description}`),
      skillsRequired: (item.skills?.length ? item.skills : inferSkills(`${item.title || ''} ${description}`).map((skill) => skill.skill))
        .slice(0, 12)
        .map((skill) => ({ skill, required: true, weight: 1 })),
      applyUrl: item.url || 'https://www.google.com/search?q=jobs',
      sourcePlatform: 'OpenWeb Ninja',
      postedAt: item.posted_at || new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
    }
  })
}

function mapJSearchLikeJobs(
  items: Array<{
    job_id?: string
    employer_name?: string
    job_title?: string
    job_city?: string | null
    job_state?: string | null
    job_country?: string | null
    job_is_remote?: boolean
    job_description?: string
    job_apply_link?: string
    job_posted_at_datetime_utc?: string
    job_min_salary?: number | null
    job_max_salary?: number | null
    job_salary_currency?: string | null
    job_employment_type?: string | null
    job_required_skills?: string[] | null
    job_required_experience?: { required_experience_in_months?: number | null } | null
  }>,
  fallbackLocation: string,
  sourceName: string,
) {
  return items.map((item) => {
    const description = item.job_description || ''
    const jobLocation = [item.job_city, item.job_state, item.job_country].filter(Boolean).join(', ') || (item.job_is_remote ? 'Remote' : fallbackLocation)
    const skills = (item.job_required_skills?.length ? item.job_required_skills : inferSkills(`${item.job_title || ''} ${description}`).map((skill) => skill.skill))
      .slice(0, 12)
      .map((skill) => ({ skill, required: true, weight: 1 }))
    const months = item.job_required_experience?.required_experience_in_months
    return {
      id: uuidFromText(`${sourceName.toLowerCase()}-${item.job_id || hash(`${item.employer_name}-${item.job_title}-${jobLocation}`)}`),
      title: item.job_title || 'Untitled role',
      company: item.employer_name || 'Unknown company',
      companyLogo: initials(item.employer_name || sourceName),
      location: jobLocation,
      country: item.job_country || countryFromLocation(jobLocation),
      city: item.job_city || cityFromLocation(jobLocation),
      isRemote: Boolean(item.job_is_remote) || /remote/i.test(`${jobLocation} ${description}`),
      workMode: item.job_is_remote ? 'remote' : inferWorkMode(`${jobLocation} ${description}`),
      description,
      descriptionHtml: `<p>${escapeHtml(description).replace(/\n/g, '</p><p>')}</p>`,
      salaryMin: item.job_min_salary || undefined,
      salaryMax: item.job_max_salary || undefined,
      salaryCurrency: item.job_salary_currency || 'USD',
      jobType: normaliseJobType(item.job_employment_type || undefined),
      experienceMin: months ? Math.floor(months / 12) : inferExperienceMin(`${item.job_title} ${description}`),
      experienceMax: months ? Math.ceil(months / 12) + 2 : inferExperienceMax(`${item.job_title} ${description}`),
      level: inferLevel(`${item.job_title} ${description}`),
      skillsRequired: skills,
      applyUrl: item.job_apply_link || 'https://www.google.com/search?q=jobs',
      sourcePlatform: sourceName,
      postedAt: item.job_posted_at_datetime_utc || new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
    }
  })
}

function getEnvList(env: Record<string, string | undefined>, listKey: string, singleKeys: string[]) {
  return [
    ...(env[listKey] || '').split(','),
    ...singleKeys.map((key) => env[key] || ''),
  ]
    .map((value) => value.trim())
    .filter((value) => value && !/dummy|placeholder|your-/i.test(value))
    .filter((value, index, list) => list.indexOf(value) === index)
}

function providerLocation(inputLocation: string | undefined, search: SearchProfile) {
  const city = search.preferredCities.find((item) => !isEmptyPreference(item) && !/^remote|any city$/i.test(item))
  const country = search.preferredCountries.find((item) => !isEmptyPreference(item) && !/^remote$/i.test(item))
  if (city && country) return `${city}, ${country}`
  if (inputLocation && !isEmptyPreference(inputLocation)) return inputLocation
  if (country) return country
  return 'Remote'
}

function adzunaCountryCode(inputLocation: string | undefined, preferredCountries: string[]) {
  const signal = normaliseForMatch([inputLocation, ...preferredCountries].filter(Boolean).join(' '))
  const entries: Array<[RegExp, string]> = [
    [/\bunited states|\busa\b|\bus\b|new york|san francisco|los angeles|chicago|austin|seattle|boston|dallas|denver|atlanta|miami/, 'us'],
    [/\bunited kingdom|\buk\b|\bgreat britain|london|manchester|birmingham|leeds|glasgow|edinburgh|bristol|liverpool/, 'gb'],
    [/\bcanada|toronto|vancouver|montreal|calgary|ottawa|edmonton|waterloo/, 'ca'],
    [/\baustralia|sydney|melbourne|brisbane|perth|adelaide|canberra/, 'au'],
    [/\bindia|bengaluru|bangalore|mumbai|delhi|hyderabad|pune|chennai|gurugram|noida|ahmedabad|kolkata/, 'in'],
    [/\bgermany|berlin|munich|hamburg|frankfurt|cologne|stuttgart|dusseldorf/, 'de'],
    [/\bfrance|paris|lyon|marseille|toulouse|lille/, 'fr'],
    [/\bnetherlands|amsterdam|rotterdam|utrecht|eindhoven|the hague/, 'nl'],
    [/\bsingapore/, 'sg'],
    [/\bnew zealand|auckland|wellington/, 'nz'],
    [/\bsouth africa|cape town|johannesburg/, 'za'],
  ]
  return entries.find(([pattern]) => pattern.test(signal))?.[1] || 'us'
}

function openWebCountryCode(inputLocation: string | undefined, preferredCountries: string[]) {
  const signal = normaliseForMatch([inputLocation, ...preferredCountries].filter(Boolean).join(' '))
  const entries: Array<[RegExp, string]> = [
    [/\bpakistan|karachi|lahore|islamabad|rawalpindi|faisalabad|peshawar|multan|hyderabad|quetta/, 'pk'],
    [/\bunited arab emirates|\buae\b|dubai|abu dhabi|sharjah|ajman/, 'ae'],
    [/\bsaudi arabia|riyadh|jeddah|dammam|khobar/, 'sa'],
    [/\bunited states|\busa\b|\bus\b|new york|san francisco|los angeles|chicago|austin|seattle|boston|dallas|denver|atlanta|miami/, 'us'],
    [/\bunited kingdom|\buk\b|\bgreat britain|london|manchester|birmingham|leeds|glasgow|edinburgh|bristol|liverpool/, 'gb'],
    [/\bcanada|toronto|vancouver|montreal|calgary|ottawa|edmonton|waterloo/, 'ca'],
    [/\baustralia|sydney|melbourne|brisbane|perth|adelaide|canberra/, 'au'],
    [/\bindia|bengaluru|bangalore|mumbai|delhi|hyderabad|pune|chennai|gurugram|noida|ahmedabad|kolkata/, 'in'],
    [/\bgermany|berlin|munich|hamburg|frankfurt|cologne|stuttgart|dusseldorf/, 'de'],
    [/\bfrance|paris|lyon|marseille|toulouse|lille/, 'fr'],
    [/\bnetherlands|amsterdam|rotterdam|utrecht|eindhoven|the hague/, 'nl'],
    [/\bsingapore/, 'sg'],
  ]
  return entries.find(([pattern]) => pattern.test(signal))?.[1] || 'us'
}

function currencyForCountry(country: string) {
  const currencies: Record<string, string> = {
    au: 'AUD',
    ca: 'CAD',
    de: 'EUR',
    fr: 'EUR',
    gb: 'GBP',
    in: 'INR',
    nl: 'EUR',
    nz: 'NZD',
    sg: 'SGD',
    us: 'USD',
    za: 'ZAR',
  }
  return currencies[country] || 'USD'
}

function countryFromLocation(location: string) {
  const parts = location.split(',').map((part) => part.trim()).filter(Boolean)
  return parts[parts.length - 1] || location || 'Remote'
}

function cityFromLocation(location: string) {
  return location.split(',').map((part) => part.trim()).filter(Boolean)[0] || location || 'Remote'
}

function lastArrayItem(values?: string[]) {
  return values?.length ? values[values.length - 1] : undefined
}

function normaliseRemotePreference(value: unknown): RemotePreference {
  return value === 'hybrid' || value === 'onsite' || value === 'any' || value === 'remote' ? value : 'remote'
}

function isEmptyPreference(value: string) {
  return /^(none|n\/a|na|not applicable|no preference)$/i.test(value.trim())
}

function inferSkills(text: string): SkillRequirement[] {
  const found = skillHints
    .filter((skill) => matchesSkillHint(text, skill))
    .slice(0, 10)
    .map((skill) => ({ skill, required: true, weight: 1 }))

  return found
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

function scoreJobRelevance(job: Job, search: SearchProfile) {
  const title = normaliseForMatch(job.title)
  const haystack = normaliseForMatch(
    `${job.title} ${job.company} ${job.description} ${job.skillsRequired.map((skill) => skill.skill).join(' ')}`,
  )
  const declaredSkills = job.skillsRequired.map((skill) => skill.skill)
  const matchedCoreSkills = search.coreSkillTerms.filter((skill) => skillMatchesJob(haystack, declaredSkills, skill))
  const matchedSecondarySkills = search.secondarySkillTerms.filter((skill) => skillMatchesJob(haystack, declaredSkills, skill))
  const matchedMustHaveSkills = search.mustHaveSkillTerms.filter((skill) => skillMatchesJob(haystack, declaredSkills, skill))
  const matchedBroadSkills = search.broadSkillTerms.filter((skill) => phraseMatches(haystack, skill))
  const roleMatches = search.roleTerms.filter((term) => phraseMatches(title, term))
  const requiredCoreMatches = search.coreSkillTerms.length >= 3 ? 2 : search.coreSkillTerms.length ? 1 : 0
  const requiredMustHaveMatches = search.mustHaveSkillTerms.length
    ? Math.min(3, Math.max(1, Math.ceil(search.mustHaveSkillTerms.length * 0.45)))
    : 0
  const hasEnoughSkills = search.coreSkillTerms.length
    ? matchedCoreSkills.length >= requiredCoreMatches
    : matchedSecondarySkills.length >= Math.min(2, search.secondarySkillTerms.length)
  const hasMustHaveFit =
    !search.mustHaveSkillTerms.length || matchedMustHaveSkills.length >= requiredMustHaveMatches
  const hasRoleFit = hasRoleMatchOrStrongSkillFit(
    job.title,
    search,
    matchedCoreSkills,
    matchedMustHaveSkills,
    matchedSecondarySkills,
  )
  const experienceFit = hasReasonableExperienceFit(job, search.experienceYears)
  const locationFit = hasLocationFit(job, search)
  const salaryFit = hasSalaryFit(job, search)
  const avoidHit = search.avoidTerms.some((term) => phraseMatches(haystack, term))
  const conflictingDomain = hasConflictingDomain(title, search)
  const disallowedTitle = hasDisallowedTitle(title, search)

  const accept =
    hasEnoughSkills &&
    hasMustHaveFit &&
    hasRoleFit &&
    experienceFit &&
    locationFit &&
    salaryFit &&
    !avoidHit &&
    !conflictingDomain &&
    !disallowedTitle
  const score =
    matchedMustHaveSkills.length * 36 +
    matchedCoreSkills.length * 45 +
    matchedSecondarySkills.length * 14 +
    matchedBroadSkills.length * 2 +
    roleMatches.length * 16 +
    (titleHasDesiredDomain(title, search) ? 18 : 0) +
    (experienceFit ? 10 : 0) +
    (locationFit ? 8 : 0) +
    (salaryFit ? 4 : 0) -
    (avoidHit ? 120 : 0) +
    Math.max(0, 8 - Math.floor((Date.now() - new Date(job.postedAt).getTime()) / 86_400_000))

  return { accept, score }
}

function hasReasonableExperienceFit(job: Job, experienceYears?: number) {
  if (experienceYears === undefined || experienceYears <= 0) return true
  const userYears = Math.floor(experienceYears)
  const lowerWindow = Math.max(0, userYears - 3)
  const inferredMin = job.experienceMin ?? levelExperienceRange(job.level).min
  const inferredMax = job.experienceMax ?? levelExperienceRange(job.level).max

  if (job.level === 'entry' && userYears >= 4) return false
  if (job.level === 'lead' && userYears < 4) return false
  if (job.level === 'senior' && userYears < 2) return false
  if (inferredMin !== undefined && inferredMin > userYears) return false
  if (inferredMax !== undefined && inferredMax < lowerWindow) return false
  return true
}

function levelExperienceRange(level: ExperienceLevel): { min?: number; max?: number } {
  if (level === 'entry') return { min: 0, max: 2 }
  if (level === 'mid') return { min: 2, max: 5 }
  if (level === 'senior') return { min: 4, max: 8 }
  if (level === 'lead') return { min: 6 }
  if (level === 'executive') return { min: 8 }
  return {}
}

function hasLocationFit(job: Job, search: SearchProfile) {
  if (search.remotePreference === 'any') return true
  if (search.remotePreference === 'remote') return job.isRemote || job.workMode === 'remote'
  if (search.remotePreference === 'hybrid' && (job.workMode === 'remote' || job.workMode === 'hybrid')) return true

  const locationText = normaliseForMatch(`${job.location} ${job.city} ${job.country}`)
  const countries = search.preferredCountries.filter((country) => !isEmptyPreference(country) && !/^remote$/i.test(country))
  const cities = search.preferredCities.filter((city) => !isEmptyPreference(city) && !/^remote|any city$/i.test(city))
  if (!countries.length && !cities.length) return true
  return [...countries, ...cities].some((place) => phraseMatches(locationText, place))
}

function hasSalaryFit(job: Job, search: SearchProfile) {
  if (!search.minimumSalary) return true
  const salary = job.salaryMax ?? job.salaryMin
  if (!salary) return true
  return salary >= Math.round(search.minimumSalary * 0.8)
}

function hasConflictingDomain(title: string, search: SearchProfile) {
  const desired = desiredDomains(search)
  if (!desired.size) return false

  const titleDomains = new Set(domainEntries.filter((entry) => entry.terms.some((term) => phraseMatches(title, term))).map((entry) => entry.name))
  if (!titleDomains.size) return false

  return !domainsOverlapOrCompatible(desired, titleDomains)
}

function titleHasDesiredDomain(title: string, search: SearchProfile) {
  const desired = desiredDomains(search)
  return [...desired].some((domain) => domainEntries.find((entry) => entry.name === domain)?.terms.some((term) => phraseMatches(title, term)))
}

function domainsOverlapOrCompatible(desired: Set<string>, titleDomains: Set<string>) {
  if ([...desired].some((domain) => titleDomains.has(domain))) return true
  if (titleDomains.has('fullstack') && (desired.has('frontend') || desired.has('backend'))) return true
  if (desired.has('fullstack') && (titleDomains.has('frontend') || titleDomains.has('backend'))) return true
  return false
}

const domainEntries = [
  { name: 'frontend', terms: ['frontend', 'front end', 'react', 'next.js', 'ui engineer', 'web developer'] },
  { name: 'backend', terms: ['backend', 'back end', 'node.js', 'api engineer', 'server', 'laravel', 'django', 'rails', 'ruby', 'ruby on rails'] },
  { name: 'fullstack', terms: ['full stack', 'fullstack', 'mern', 'mean'] },
  { name: 'mobile', terms: ['mobile', 'android', 'ios', 'react native', 'flutter'] },
  { name: 'data', terms: ['data engineer', 'data scientist', 'machine learning', 'ml engineer', 'analytics engineer'] },
  { name: 'devops', terms: ['devops', 'sre', 'site reliability', 'cloud engineer', 'platform engineer', 'infrastructure'] },
  { name: 'qa', terms: ['qa engineer', 'test engineer', 'automation engineer', 'automated test', 'cypress', 'playwright'] },
  { name: 'design', terms: ['designer', 'ui/ux', 'product designer', 'ux designer'] },
]

function desiredDomains(search: SearchProfile) {
  const desired = new Set<string>()
  const signal = normaliseForMatch([search.rawQuery, ...search.roleTerms, ...search.coreSkillTerms, ...search.secondarySkillTerms].join(' '))
  for (const entry of domainEntries) {
    if (entry.terms.some((term) => phraseMatches(signal, term))) desired.add(entry.name)
  }
  if (desired.has('fullstack')) {
    desired.add('frontend')
    desired.add('backend')
  }
  if (desired.has('frontend') && desired.has('backend')) desired.add('fullstack')
  return desired
}

function hasDisallowedTitle(title: string, search: SearchProfile) {
  const target = normaliseForMatch(search.rawQuery)
  const allowedAdminSearch = /(assistant|administrator|admin|data entry|research|support|sales|marketing|recruit|customer)/.test(target)
  if (allowedAdminSearch) return false

  return /\b(data entry|assistant|administrator|admin assistant|research panel|survey|customer support|sales|marketing|recruiter|bookkeeper|virtual assistant)\b/i.test(
    title,
  )
}

function titleMatchesRole(titleValue: string, search: SearchProfile) {
  const title = normaliseForMatch(titleValue)
  const strictRole = normaliseForMatch(search.strictRoleQuery)
  const targetRoleTerms = extractImportantTitleTerms(strictRole)
  const roleTermMatches = search.roleTerms.filter((term) => phraseMatches(title, term))

  if (strictRole && phraseMatches(title, strictRole)) return true
  if (targetRoleTerms.length >= 2 && targetRoleTerms.every((term) => phraseMatches(title, term))) return true
  if (targetRoleTerms.length === 1 && phraseMatches(title, targetRoleTerms[0])) return true
  if (search.roleTerms.length >= 2 && roleTermMatches.length >= Math.min(2, search.roleTerms.length)) return true
  if (search.roleTerms.length === 1 && roleTermMatches.length === 1) return true
  if (titleHasDesiredDomain(title, search) && hasTechnicalRoleTitle(title)) return true

  const coreTitleMatches = search.coreSkillTerms.filter((skill) => phraseMatches(title, skill) || skillsEquivalent(title, skill))
  if (hasTechnicalTarget(search) && hasTechnicalRoleTitle(title) && coreTitleMatches.length > 0) return true
  return false
}

function resultMatchesRoleOrStrongSkills(titleValue: string, snippet: string, search: SearchProfile) {
  if (titleMatchesRole(titleValue, search)) return true
  const title = normaliseForMatch(titleValue)
  if (!hasTechnicalTarget(search) || !hasTechnicalRoleTitle(title)) return false
  if (hasDisallowedTitle(title, search) || hasConflictingDomain(title, search)) return false

  const haystack = normaliseForMatch(`${titleValue} ${snippet}`)
  const matchedCoreSkills = search.coreSkillTerms.filter((skill) => phraseMatches(haystack, skill))
  const matchedSecondarySkills = search.secondarySkillTerms.filter((skill) => phraseMatches(haystack, skill))
  const matchedMustHaveSkills = search.mustHaveSkillTerms.filter((skill) => phraseMatches(haystack, skill))
  return hasStrongSkillEvidence(search, matchedCoreSkills, matchedMustHaveSkills, matchedSecondarySkills)
}

function hasRoleMatchOrStrongSkillFit(
  titleValue: string,
  search: SearchProfile,
  matchedCoreSkills: string[],
  matchedMustHaveSkills: string[],
  matchedSecondarySkills: string[],
) {
  if (titleMatchesRole(titleValue, search)) return true
  const title = normaliseForMatch(titleValue)
  if (!hasTechnicalTarget(search) || !hasTechnicalRoleTitle(title)) return false
  return hasStrongSkillEvidence(search, matchedCoreSkills, matchedMustHaveSkills, matchedSecondarySkills)
}

function hasStrongSkillEvidence(
  search: SearchProfile,
  matchedCoreSkills: string[],
  matchedMustHaveSkills: string[],
  matchedSecondarySkills: string[],
) {
  if (search.mustHaveSkillTerms.length && matchedMustHaveSkills.length >= Math.min(2, search.mustHaveSkillTerms.length)) {
    return true
  }

  const requiredCoreMatches = search.coreSkillTerms.length >= 3 ? 2 : search.coreSkillTerms.length
  if (requiredCoreMatches && matchedCoreSkills.length >= requiredCoreMatches) return true

  return matchedCoreSkills.length >= 1 && matchedSecondarySkills.length >= 2
}

function extractImportantTitleTerms(value: string) {
  return dedupeTerms(
    value
      .split(/\s+/)
      .filter((term) => term.length > 2)
      .filter((term) => !genericRoleTerms.has(term))
      .filter((term) => !/^(and|with|for)$/i.test(term)),
  )
}

function hasTechnicalTarget(search: SearchProfile) {
  return (
    /\b(engineer|developer|software|frontend|backend|full stack|fullstack|web|rails|ruby|react|javascript|typescript|node)\b/i.test(
      search.rawQuery,
    ) || desiredDomains(search).size > 0
  )
}

function hasRoleLanguage(value: string) {
  return /\b(engineer|developer|architect|programmer|analyst|designer|manager|specialist|consultant|administrator|lead|intern|director|head)\b/i.test(
    value,
  )
}

function hasTechnicalRoleTitle(title: string) {
  return /\b(engineer|developer|architect|programmer)\b/i.test(title)
}

function extractRoleTerms(query: string, skills: string[]) {
  const skillSet = new Set(skills.map(normaliseForMatch))
  return dedupeTerms(
    cleanSearchTerm(query)
      .split(/\s+/)
      .filter((term) => term.length > 2)
      .filter((term) => !genericRoleTerms.has(term))
      .filter((term) => !skillSet.has(term)),
  ).slice(0, 5)
}

const genericRoleTerms = new Set([
  'job',
  'jobs',
  'career',
  'careers',
  'vacancy',
  'vacancies',
  'opening',
  'openings',
  'hiring',
  'hire',
  'position',
  'positions',
  'apply',
  'role',
  'remote',
  'software',
  'engineer',
  'developer',
  'senior',
  'junior',
  'lead',
  'mid',
  'level',
])

function dedupeTerms(terms: string[]) {
  const seen = new Set<string>()
  return terms
    .map(cleanSearchTerm)
    .filter((term) => term.length >= 2)
    .filter((term) => {
      const key = normaliseForMatch(term)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 30)
}

const broadSearchSkills = new Set([
  'agile',
  'communication',
  'leadership',
  'product thinking',
  'git',
  'github',
  'data analysis',
])

const secondarySearchSkills = new Set([
  'aws',
  'ci/cd',
  'docker',
  'kubernetes',
  'terraform',
  'vercel',
  'firebase',
  'supabase',
])

const skillPriority = [
  'ruby on rails',
  'ruby',
  'react',
  'typescript',
  'javascript',
  'next.js',
  'node.js',
  'laravel',
  'php',
  'python',
  'django',
  'fastapi',
  'graphql',
  'rest apis',
  'sql',
  'postgresql',
  'mysql',
  'mongodb',
  'redis',
  'html',
  'css',
  'tailwind',
]

function isCoreSearchSkill(skill: string, rawQuery: string) {
  const normalised = normaliseForMatch(skill)
  if (normalised === 'data analysis' && !/\b(data|analytics|analyst|scientist|machine learning|ml)\b/i.test(rawQuery)) return false
  return !broadSearchSkills.has(normalised) && !secondarySearchSkills.has(normalised)
}

function isBroadSearchSkill(skill: string, rawQuery: string) {
  const normalised = normaliseForMatch(skill)
  if (normalised === 'data analysis' && /\b(data|analytics|analyst|scientist|machine learning|ml)\b/i.test(rawQuery)) return false
  return broadSearchSkills.has(normalised)
}

function sortSkillsForSearch(skills: string[]) {
  return [...skills].sort((a, b) => skillSearchRank(a) - skillSearchRank(b) || a.localeCompare(b))
}

function skillSearchRank(skill: string) {
  const index = skillPriority.indexOf(normaliseForMatch(skill))
  return index === -1 ? 100 : index
}

function matchesSkillHint(text: string, skill: string) {
  const haystack = normaliseForMatch(text)
  if (skill === 'Ruby on Rails') return /\b(ruby on rails|rails)\b/i.test(haystack)
  if (skill === 'Ruby') return /\bruby\b/i.test(haystack)
  if (skill === 'Data Analysis') return /\b(data analysis|data analytics|analytics|pandas|numpy)\b/i.test(haystack)
  if (skill === 'REST APIs') return /\b(rest api|rest apis|restful|api design)\b/i.test(haystack)
  if (skill === 'CI/CD') return /\b(ci\/cd|ci cd|github actions|gitlab ci)\b/i.test(haystack)
  return phraseMatches(haystack, skill)
}

function cleanSearchTerm(value: string) {
  return value.replace(/[^\w\s+#./-]/g, ' ').replace(/\s+/g, ' ').trim()
}

function phraseMatches(text: string, phrase: string) {
  const normalisedPhrase = normaliseForMatch(phrase)
  if (!normalisedPhrase) return false
  const escaped = normalisedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const boundaryStart = /^[a-z0-9]/.test(normalisedPhrase) ? '\\b' : ''
  const boundaryEnd = /[a-z0-9]$/.test(normalisedPhrase) ? '\\b' : ''
  return new RegExp(`${boundaryStart}${escaped}${boundaryEnd}`, 'i').test(text)
}

function normaliseForMatch(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function skillsEquivalent(left: string, right: string) {
  return normaliseSkillForCompare(left) === normaliseSkillForCompare(right)
}

function skillMatchesJob(haystack: string, declaredSkills: string[], skill: string) {
  if (phraseMatches(haystack, skill)) return true
  if (declaredSkills.some((declared) => skillsEquivalent(declared, skill))) return true

  const normalised = normaliseSkillForCompare(skill)
  if (normalised === 'ruby on rails') {
    return phraseMatches(haystack, 'rails') && (phraseMatches(haystack, 'ruby') || hasTechnicalRoleTitle(haystack))
  }
  return false
}

function normaliseSkillForCompare(skill: string) {
  const normalised = normaliseForMatch(skill).replace(/[^a-z0-9+#. ]/g, '').replace(/\s+/g, ' ')
  const aliases: Record<string, string> = {
    'react.js': 'react',
    reactjs: 'react',
    'node.js': 'nodejs',
    node: 'nodejs',
    'rest api': 'rest apis',
    restful: 'rest apis',
    postgres: 'postgresql',
    rails: 'ruby on rails',
  }
  return aliases[normalised] || normalised
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

function hostFromUrl(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    return 'career site'
  }
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
