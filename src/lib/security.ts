import type { Application, CvExperience, CvProfile, CvSkill, Job, ParsedCvPayload, UserProfile } from '../types'

const htmlTagPattern = /<[^>]*>/g
const scriptStylePattern = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi
const eventHandlerPattern = /\son\w+\s*=\s*(['"]).*?\1/gi
const dangerousUrlPattern = /\b(?:javascript|data|vbscript):/gi

export function sanitiseText(value: unknown, maxLength = 500) {
  return Array.from(String(value ?? ''))
    .map(controlCharacterFilter)
    .join('')
    .replace(scriptStylePattern, '')
    .replace(eventHandlerPattern, '')
    .replace(dangerousUrlPattern, '')
    .replace(htmlTagPattern, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function controlCharacterFilter(char: string) {
  const code = char.charCodeAt(0)
  return (code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127
    ? ''
    : char
}

export function sanitiseLongText(value: unknown, maxLength = 20_000) {
  return sanitiseText(value, maxLength)
}

export function sanitiseUrl(value: unknown, fallback = '#') {
  const raw = String(value ?? '').trim()
  try {
    const parsed = new URL(raw)
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.toString()
  } catch {
    return fallback
  }
  return fallback
}

export function safeHtmlParagraphs(value: unknown) {
  const text = sanitiseLongText(value)
  if (!text) return '<p></p>'
  return `<p>${escapeHtml(text).replace(/\n+/g, '</p><p>')}</p>`
}

export function escapeHtml(value: string) {
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

export function clampNumber(value: unknown, min: number, max: number, fallback = min) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(Math.max(number, min), max)
}

export function sanitiseSkill(skill: CvSkill): CvSkill {
  return {
    skillName: sanitiseText(skill.skillName, 80),
    skillCanonical: sanitiseText(skill.skillCanonical || skill.skillName, 80),
    skillType: skill.skillType,
    yearsUsed: clampNumber(skill.yearsUsed, 0, 60, 0),
    skillRank: Math.round(clampNumber(skill.skillRank ?? defaultSkillRank(skill), 0, 100, 70)),
    confidence: skill.confidence,
    isManual: Boolean(skill.isManual),
  }
}

function defaultSkillRank(skill: Pick<CvSkill, 'confidence' | 'yearsUsed'>) {
  const confidenceBase = skill.confidence === 'high' ? 84 : skill.confidence === 'medium' ? 68 : 48
  const yearBoost = Math.min(12, Math.round((Number(skill.yearsUsed) || 0) * 2))
  return Math.min(96, confidenceBase + yearBoost)
}

export function sanitiseExperience(item: CvExperience): CvExperience {
  return {
    title: sanitiseText(item.title, 160),
    company: sanitiseText(item.company, 160),
    startDate: sanitiseDateLike(item.startDate),
    endDate: item.endDate ? sanitiseDateLike(item.endDate) : null,
    isCurrent: Boolean(item.isCurrent),
    totalMonths: Math.round(clampNumber(item.totalMonths, 0, 720, 0)),
  }
}

export function sanitiseParsedCv(cv: ParsedCvPayload): ParsedCvPayload {
  const skills = cv.skills.map(sanitiseSkill).filter((skill) => skill.skillName)
  const experience = cv.experience.map(sanitiseExperience).filter((item) => item.startDate || item.title || item.company)

  return {
    label: sanitiseText(cv.label, 160),
    filename: sanitiseText(cv.filename, 160),
    text: sanitiseLongText(cv.text, 50_000),
    skills,
    experience,
    totalYearsExperience: clampNumber(cv.totalYearsExperience, 0, 60, 0),
    education: cv.education.map((item) => sanitiseText(item, 240)).filter(Boolean),
    certifications: cv.certifications.map((item) => sanitiseText(item, 240)).filter(Boolean),
    warnings: cv.warnings.map((item) => sanitiseText(item, 240)).filter(Boolean),
  }
}

export function sanitiseCvProfile(cv: CvProfile): CvProfile {
  return {
    ...cv,
    label: sanitiseText(cv.label, 160),
    filename: sanitiseText(cv.filename, 160),
    skills: cv.skills.map(sanitiseSkill).filter((skill) => skill.skillName),
    experience: cv.experience.map(sanitiseExperience),
    totalYearsExperience: clampNumber(cv.totalYearsExperience, 0, 60, 0),
  }
}

export function sanitiseUserProfile(profile: UserProfile): UserProfile {
  const targetRoles = sanitiseTextList(profile.targetRoles, 10, 120)
  const mustHaveSkills = sanitiseTextList(profile.mustHaveSkills, 30, 80)
  const preferredCountries = sanitiseTextList(profile.preferredCountries, 8, 80)
  const preferredCities = sanitiseTextList(profile.preferredCities, 12, 80)
  const remotePreference = sanitiseRemotePreference(profile.remotePreference)
  const minimumSalary = Math.round(clampNumber(profile.minimumSalary ?? profile.salaryMin, 0, 1_000_000, 0))

  return {
    ...profile,
    email: sanitiseText(profile.email, 254),
    name: sanitiseText(profile.name, 160),
    headline: sanitiseText(profile.headline, 240),
    location: sanitiseText(profile.location, 120),
    targetRole: sanitiseText(profile.targetRole || targetRoles[0] || '', 160),
    targetRoles,
    mustHaveSkills,
    avoidKeywords: sanitiseTextList(profile.avoidKeywords, 30, 80),
    preferredCountries: preferredCountries.length ? preferredCountries : ['Remote'],
    preferredCities: preferredCities.length ? preferredCities : ['Remote'],
    remotePreference,
    preferredRemote: remotePreference === 'remote' || remotePreference === 'any' ? true : Boolean(profile.preferredRemote),
    minimumSalary,
    experienceYears: Math.round(clampNumber(profile.experienceYears, 0, 60, 0)),
    goodJobExamples: sanitiseTextList(profile.goodJobExamples, 12, 240),
    badJobExamples: sanitiseTextList(profile.badJobExamples, 12, 240),
    profileCompletedAt: sanitiseIsoDate(profile.profileCompletedAt),
    salaryMin: Math.round(clampNumber(profile.salaryMin, 0, 1_000_000, 0)),
    salaryMax: Math.round(clampNumber(profile.salaryMax, 0, 1_000_000, 0)),
    currency: /^[A-Z]{3}$/.test(profile.currency) ? profile.currency : 'USD',
  }
}

function sanitiseTextList(values: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(values)) return []
  const seen = new Set<string>()
  return values
    .map((value) => sanitiseText(value, maxLength))
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, maxItems)
}

function sanitiseRemotePreference(value: unknown): UserProfile['remotePreference'] {
  return value === 'hybrid' || value === 'onsite' || value === 'any' || value === 'remote' ? value : 'remote'
}

function sanitiseIsoDate(value: unknown) {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function sanitiseJob(job: Job): Job {
  const description = sanitiseLongText(job.description)

  return {
    ...job,
    title: sanitiseText(job.title, 240),
    company: sanitiseText(job.company, 180),
    companyLogo: job.companyLogo ? sanitiseText(job.companyLogo, 12) : undefined,
    location: sanitiseText(job.location, 180),
    country: sanitiseText(job.country, 120),
    city: sanitiseText(job.city, 120),
    description,
    descriptionHtml: safeHtmlParagraphs(job.descriptionHtml || description),
    salaryMin: job.salaryMin === undefined ? undefined : Math.round(clampNumber(job.salaryMin, 0, 2_000_000, 0)),
    salaryMax: job.salaryMax === undefined ? undefined : Math.round(clampNumber(job.salaryMax, 0, 2_000_000, 0)),
    salaryCurrency: /^[A-Z]{3}$/.test(job.salaryCurrency) ? job.salaryCurrency : 'USD',
    experienceMin: job.experienceMin === undefined ? undefined : clampNumber(job.experienceMin, 0, 60, 0),
    experienceMax: job.experienceMax === undefined ? undefined : clampNumber(job.experienceMax, 0, 60, 0),
    skillsRequired: job.skillsRequired
      .map((skill) => ({
        skill: sanitiseText(skill.skill, 80),
        required: Boolean(skill.required),
        weight: clampNumber(skill.weight, 0, 5, 1),
      }))
      .filter((skill) => skill.skill),
    applyUrl: sanitiseUrl(job.applyUrl, 'https://www.google.com/search?q=jobs'),
    sourcePlatform: sanitiseText(job.sourcePlatform, 120),
  }
}

export function sanitiseApplication(application: Application): Application {
  return {
    ...application,
    notes: sanitiseText(application.notes, 1_000),
    history: application.history.map((item) => ({
      ...item,
      note: sanitiseText(item.note, 500),
    })),
  }
}

function sanitiseDateLike(value: string) {
  const text = String(value || '').slice(0, 10)
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(text)) return text
  return ''
}
