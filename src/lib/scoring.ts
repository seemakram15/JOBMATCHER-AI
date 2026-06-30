import type { CvProfile, Job, JobFilters, JobMatch, ScoredJob, UserProfile } from '../types'

const skillAliases: Record<string, string> = {
  reactjs: 'react',
  'react.js': 'react',
  node: 'nodejs',
  'node.js': 'nodejs',
  nodejs: 'nodejs',
  postgres: 'postgresql',
  postgresql: 'postgresql',
  js: 'javascript',
  ts: 'typescript',
  'tailwind css': 'tailwind',
  tailwindcss: 'tailwind',
  ml: 'machine learning',
  ai: 'artificial intelligence',
  rest: 'rest apis',
  api: 'rest apis',
}

const tokenise = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

export const normaliseSkill = (skill: string) => {
  const normalised = skill.toLowerCase().replace(/[^a-z0-9+#. ]/g, '').trim()
  return skillAliases[normalised] ?? normalised.replace(/\s+/g, ' ')
}

const skillsMatch = (candidate: string, required: string) =>
  normaliseSkill(candidate) === normaliseSkill(required)

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export function getScoreLabel(score: number) {
  if (score >= 80) return { label: 'Excellent Match', color: 'success' }
  if (score >= 60) return { label: 'Good Match', color: 'cyan' }
  if (score >= 40) return { label: 'Partial Match', color: 'warning' }
  if (score >= 20) return { label: 'Weak Match', color: 'orange' }
  return { label: 'Poor Match', color: 'danger' }
}

export function experienceFit(userYears: number, min?: number, max?: number) {
  if (!min && !max) return 0.85
  const lower = min ?? 0
  const upper = max ?? Math.max(lower, userYears)

  if (userYears >= lower && userYears <= upper) return 1
  if (userYears < lower) {
    const gap = lower - userYears
    if (gap <= 1) return 0.8
    if (gap <= 2) return 0.6
    if (gap <= 4) return 0.35
    return 0.2
  }

  const overqualifiedBy = userYears - upper
  if (overqualifiedBy <= 1) return 0.9
  if (overqualifiedBy <= 3) return 0.78
  return 0.65
}

export function titleSimilarity(targetRole: string, jobTitle: string) {
  const targetTokens = new Set(tokenise(targetRole).map(normaliseSkill))
  const jobTokens = new Set(tokenise(jobTitle).map(normaliseSkill))
  const overlaps = [...targetTokens].filter((token) => jobTokens.has(token)).length
  const seniorityBoost =
    (targetRole.toLowerCase().includes('senior') && jobTitle.toLowerCase().includes('senior')) ||
    (targetRole.toLowerCase().includes('lead') && jobTitle.toLowerCase().includes('lead'))
      ? 0.16
      : 0

  return clamp(overlaps / Math.max(targetTokens.size, 1) + seniorityBoost, 0.25, 1)
}

export function computeMatch(profile: UserProfile, cv: CvProfile, job: Job): JobMatch {
  const userSkills = [
    ...profile.mustHaveSkills,
    ...cv.skills.map((skill) => skill.skillCanonical || skill.skillName),
  ].filter(Boolean)
  const userSkillRanks = new Map(
    [
      ...profile.mustHaveSkills.map((skill) => [normaliseSkill(skill), 86] as const),
      ...cv.skills.map((skill) => [normaliseSkill(skill.skillCanonical || skill.skillName), Math.min(Math.max(skill.skillRank || 70, 0), 100)] as const),
    ],
  )
  const requiredSkills = job.skillsRequired.filter((skill) => skill.required)
  const optionalSkills = job.skillsRequired.filter((skill) => !skill.required)
  const matchedRequired = requiredSkills.filter((required) =>
    userSkills.some((candidate) => skillsMatch(candidate, required.skill)),
  )
  const matchedOptional = optionalSkills.filter((required) =>
    userSkills.some((candidate) => skillsMatch(candidate, required.skill)),
  )
  const missingSkills = requiredSkills
    .filter((required) => !matchedRequired.includes(required))
    .map((skill) => skill.skill)

  const hasCoreRequiredSkill = requiredSkills.some((skill) => !isLowSignalSkill(skill.skill))
  const requiredWeight = requiredSkills.reduce((total, skill) => total + skill.weight, 0) || 1
  const matchedWeight = matchedRequired.reduce((total, skill) => total + skill.weight * skillRankMultiplier(skill.skill, userSkillRanks), 0)
  const optionalBonus = Math.min(matchedOptional.length * 1.5, 5)
  const rawSkillScore = clamp(Math.round((matchedWeight / requiredWeight) * 50 + optionalBonus), 0, 50)
  const skillScore = hasCoreRequiredSkill || !requiredSkills.length ? rawSkillScore : Math.min(rawSkillScore, 12)

  const experienceScore = Math.round(
    experienceFit(cv.totalYearsExperience, job.experienceMin, job.experienceMax) * 20,
  )
  const roleSignal = profile.targetRoles?.length ? profile.targetRoles.join(' ') : profile.targetRole
  const titleScore = Math.round(titleSimilarity(roleSignal, job.title) * 15)
  const locationScore = Math.round(
    locationFitMultiplier(profile, job) * 10,
  )
  const ageHours = (Date.now() - new Date(job.postedAt).getTime()) / 36e5
  const recencyBonus = ageHours <= 48 ? 5 : ageHours <= 96 ? 3 : 0
  const totalScore = clamp(skillScore + experienceScore + titleScore + locationScore + recencyBonus, 0, 100)
  const matchedSkills = [...matchedRequired, ...matchedOptional].map((skill) => skill.skill)

  const matchSummary =
    totalScore >= 80
      ? `Strong fit: ${matchedSkills.slice(0, 3).join(', ')} line up with the role, and your experience sits inside the requested range.`
      : totalScore >= 60
        ? `Good fit with a few gaps. You match ${matchedSkills.slice(0, 3).join(', ') || 'several core signals'}, but ${missingSkills[0] ?? 'one requirement'} needs attention.`
        : `Partial fit. The role is worth watching, but the current CV is missing ${missingSkills.slice(0, 2).join(' and ') || 'key requirements'}.`

  return {
    totalScore,
    skillScore,
    experienceScore,
    titleScore,
    locationScore,
    recencyBonus,
    matchedSkills,
    missingSkills,
    matchSummary,
  }
}

function locationFitMultiplier(profile: UserProfile, job: Job) {
  if (profile.remotePreference === 'any') return 0.88
  if (profile.remotePreference === 'remote') {
    if (job.workMode === 'remote' || job.isRemote) return 1
    if (job.workMode === 'hybrid') return 0.62
    return 0.22
  }
  if (profile.remotePreference === 'hybrid') {
    if (job.workMode === 'hybrid') return 1
    if (job.workMode === 'remote') return 0.84
    return profileLocationMatches(profile, job) ? 0.72 : 0.34
  }
  return profileLocationMatches(profile, job) ? 1 : job.workMode === 'remote' ? 0.46 : 0.28
}

function profileLocationMatches(profile: UserProfile, job: Job) {
  const places = [...(profile.preferredCountries || []), ...(profile.preferredCities || [])]
    .filter((place) => !/^(remote|any city|none|n\/a)$/i.test(place))
    .map((place) => place.toLowerCase())
  if (!places.length) return true
  const location = `${job.location} ${job.country} ${job.city}`.toLowerCase()
  return places.some((place) => location.includes(place))
}

function skillRankMultiplier(skill: string, userSkillRanks: Map<string, number>) {
  const rank = userSkillRanks.get(normaliseSkill(skill)) ?? 70
  return 0.7 + (rank / 100) * 0.3
}

function isLowSignalSkill(skill: string) {
  return ['communication', 'agile', 'leadership', 'product thinking', 'git', 'github', 'data analysis'].includes(
    normaliseSkill(skill),
  )
}

export function scoreJobs(profile: UserProfile, cv: CvProfile, jobs: Job[], savedJobIds: string[]): ScoredJob[] {
  return jobs.map((job) => ({
    job,
    match: computeMatch(profile, cv, job),
    isSaved: savedJobIds.includes(job.id),
  }))
}

const postedAfter = (datePosted: JobFilters['datePosted']) => {
  const now = Date.now()
  if (datePosted === 'today') return now - 24 * 36e5
  if (datePosted === '3days') return now - 72 * 36e5
  if (datePosted === 'week') return now - 7 * 24 * 36e5
  if (datePosted === 'month') return now - 30 * 24 * 36e5
  return 0
}

export function filterAndSortJobs(jobs: ScoredJob[], filters: JobFilters) {
  const queryTokens = tokenise(filters.search).map(normaliseSkill)
  const earliestPosted = postedAfter(filters.datePosted)

  return jobs
    .filter(({ job, match }) => {
      const searchable = tokenise(`${job.title} ${job.company} ${job.description} ${job.skillsRequired
        .map((skill) => skill.skill)
        .join(' ')}`).map(normaliseSkill)
      const salary = job.salaryMax ?? job.salaryMin ?? 0
      return (
        match.totalScore >= filters.scoreMin &&
        (!queryTokens.length || queryTokens.every((token) => searchable.some((item) => item.includes(token)))) &&
        (!filters.workModes.length || filters.workModes.includes(job.workMode)) &&
        (!filters.jobTypes.length || filters.jobTypes.includes(job.jobType)) &&
        (!filters.levels.length || filters.levels.includes(job.level)) &&
        (!filters.sources.length || filters.sources.includes(job.sourcePlatform)) &&
        (!filters.salaryMin || salary >= filters.salaryMin) &&
        (!earliestPosted || new Date(job.postedAt).getTime() >= earliestPosted)
      )
    })
    .sort((a, b) => {
      if (filters.sort === 'date') return +new Date(b.job.postedAt) - +new Date(a.job.postedAt)
      if (filters.sort === 'salary') return (b.job.salaryMax ?? 0) - (a.job.salaryMax ?? 0)
      if (filters.sort === 'company') return a.job.company.localeCompare(b.job.company)
      return b.match.totalScore - a.match.totalScore
    })
}
