import type { CvExperience, CvSkill } from '../types'

export interface ParsedCvDocument {
  label: string
  filename: string
  text: string
  skills: CvSkill[]
  experience: CvExperience[]
  totalYearsExperience: number
  education: string[]
  certifications: string[]
  warnings: string[]
}

interface SkillDefinition {
  canonical: string
  type: CvSkill['skillType']
  aliases: string[]
}

const skillTaxonomy: SkillDefinition[] = [
  { canonical: 'React', type: 'framework', aliases: ['react', 'react.js', 'reactjs'] },
  { canonical: 'Next.js', type: 'framework', aliases: ['next.js', 'nextjs', 'next js'] },
  { canonical: 'Vue', type: 'framework', aliases: ['vue', 'vue.js', 'vuejs'] },
  { canonical: 'Angular', type: 'framework', aliases: ['angular'] },
  { canonical: 'TypeScript', type: 'technical', aliases: ['typescript', 'ts'] },
  { canonical: 'JavaScript', type: 'technical', aliases: ['javascript', 'js', 'ecmascript'] },
  { canonical: 'Node.js', type: 'technical', aliases: ['node.js', 'nodejs', 'node'] },
  { canonical: 'Express', type: 'framework', aliases: ['express', 'express.js', 'expressjs'] },
  { canonical: 'NestJS', type: 'framework', aliases: ['nestjs', 'nest.js'] },
  { canonical: 'Python', type: 'technical', aliases: ['python'] },
  { canonical: 'Django', type: 'framework', aliases: ['django'] },
  { canonical: 'FastAPI', type: 'framework', aliases: ['fastapi', 'fast api'] },
  { canonical: 'PHP', type: 'technical', aliases: ['php'] },
  { canonical: 'Laravel', type: 'framework', aliases: ['laravel'] },
  { canonical: 'Ruby on Rails', type: 'framework', aliases: ['ruby on rails', 'rails'] },
  { canonical: 'Java', type: 'technical', aliases: ['java'] },
  { canonical: 'Spring Boot', type: 'framework', aliases: ['spring boot', 'springboot'] },
  { canonical: 'C#', type: 'technical', aliases: ['c#', 'csharp', 'c sharp'] },
  { canonical: '.NET', type: 'framework', aliases: ['.net', 'dotnet', 'asp.net'] },
  { canonical: 'Go', type: 'technical', aliases: ['golang', 'go'] },
  { canonical: 'Rust', type: 'technical', aliases: ['rust'] },
  { canonical: 'Swift', type: 'technical', aliases: ['swift'] },
  { canonical: 'Kotlin', type: 'technical', aliases: ['kotlin'] },
  { canonical: 'React Native', type: 'framework', aliases: ['react native'] },
  { canonical: 'Flutter', type: 'framework', aliases: ['flutter', 'dart'] },
  { canonical: 'HTML', type: 'technical', aliases: ['html', 'html5'] },
  { canonical: 'CSS', type: 'technical', aliases: ['css', 'css3'] },
  { canonical: 'Tailwind', type: 'framework', aliases: ['tailwind', 'tailwind css', 'tailwindcss'] },
  { canonical: 'Sass', type: 'tool', aliases: ['sass', 'scss'] },
  { canonical: 'GraphQL', type: 'technical', aliases: ['graphql', 'apollo'] },
  { canonical: 'REST APIs', type: 'technical', aliases: ['rest api', 'rest apis', 'restful', 'api design'] },
  { canonical: 'PostgreSQL', type: 'technical', aliases: ['postgresql', 'postgres'] },
  { canonical: 'MySQL', type: 'technical', aliases: ['mysql'] },
  { canonical: 'MongoDB', type: 'technical', aliases: ['mongodb', 'mongo'] },
  { canonical: 'Redis', type: 'technical', aliases: ['redis'] },
  { canonical: 'Supabase', type: 'tool', aliases: ['supabase'] },
  { canonical: 'Firebase', type: 'tool', aliases: ['firebase', 'firestore'] },
  { canonical: 'AWS', type: 'tool', aliases: ['aws', 'amazon web services', 'lambda', 's3', 'ec2'] },
  { canonical: 'Vercel', type: 'tool', aliases: ['vercel'] },
  { canonical: 'Docker', type: 'tool', aliases: ['docker'] },
  { canonical: 'Kubernetes', type: 'tool', aliases: ['kubernetes', 'k8s'] },
  { canonical: 'Terraform', type: 'tool', aliases: ['terraform'] },
  { canonical: 'CI/CD', type: 'tool', aliases: ['ci/cd', 'ci cd', 'github actions', 'gitlab ci'] },
  { canonical: 'Git', type: 'tool', aliases: ['git', 'github', 'gitlab', 'bitbucket'] },
  { canonical: 'Vite', type: 'tool', aliases: ['vite'] },
  { canonical: 'Webpack', type: 'tool', aliases: ['webpack'] },
  { canonical: 'Jest', type: 'tool', aliases: ['jest'] },
  { canonical: 'Vitest', type: 'tool', aliases: ['vitest'] },
  { canonical: 'Playwright', type: 'tool', aliases: ['playwright'] },
  { canonical: 'Cypress', type: 'tool', aliases: ['cypress'] },
  { canonical: 'Machine Learning', type: 'technical', aliases: ['machine learning', 'ml', 'deep learning'] },
  { canonical: 'Data Analysis', type: 'technical', aliases: ['data analysis', 'analytics', 'pandas', 'numpy'] },
  { canonical: 'Product Thinking', type: 'soft', aliases: ['product thinking', 'product strategy', 'user research'] },
  { canonical: 'Leadership', type: 'soft', aliases: ['leadership', 'team lead', 'mentoring', 'mentor'] },
  { canonical: 'Communication', type: 'soft', aliases: ['communication', 'stakeholder management', 'collaboration'] },
  { canonical: 'Agile', type: 'soft', aliases: ['agile', 'scrum', 'kanban'] },
]

const monthIndexes: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
}

const roleWords =
  /(engineer|developer|designer|manager|lead|architect|consultant|analyst|specialist|intern|administrator|devops|scientist)/i

export function parseCvText(text: string, filename = 'uploaded-cv'): ParsedCvDocument {
  const cleanText = normaliseText(text)
  const warnings: string[] = []

  if (cleanText.length < 200) {
    warnings.push('The extracted text is short. Scanned PDFs may need OCR before parsing.')
  }

  const explicitYears = extractExplicitYears(cleanText)
  const experience = extractExperience(cleanText)
  const durationYears = experience.reduce((total, item) => total + item.totalMonths, 0) / 12
  const totalYearsExperience = roundYears(Math.max(explicitYears, durationYears))
  const skills = extractSkills(cleanText, totalYearsExperience)
  const education = extractEducation(cleanText)
  const certifications = extractCertifications(cleanText)

  return {
    label: filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') || 'Uploaded CV',
    filename,
    text: cleanText,
    skills,
    experience,
    totalYearsExperience,
    education,
    certifications,
    warnings,
  }
}

function normaliseText(text: string) {
  return text
    .split(String.fromCharCode(0))
    .join(' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractSkills(text: string, totalYearsExperience: number): CvSkill[] {
  const matches: CvSkill[] = []

  for (const definition of skillTaxonomy) {
    const matchedAlias = definition.aliases.find((alias) => containsPhrase(text, alias))
    if (!matchedAlias) continue

    matches.push({
      skillName: definition.canonical,
      skillCanonical: definition.canonical,
      skillType: definition.type,
      yearsUsed: estimateSkillYears(text, matchedAlias, totalYearsExperience),
      confidence: matchedAlias === definition.canonical.toLowerCase() ? 'high' : 'medium',
    })
  }

  return matches.sort((a, b) => b.yearsUsed - a.yearsUsed || a.skillName.localeCompare(b.skillName))
}

function containsPhrase(text: string, phrase: string) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const boundaryStart = /^[a-z0-9]/i.test(phrase) ? '\\b' : ''
  const boundaryEnd = /[a-z0-9]$/i.test(phrase) ? '\\b' : ''
  return new RegExp(`${boundaryStart}${escaped}${boundaryEnd}`, 'i').test(text)
}

function estimateSkillYears(text: string, skillAlias: string, totalYearsExperience: number) {
  const escaped = skillAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const nearbyYears = [
    new RegExp(`(\\d+(?:\\.\\d+)?)\\+?\\s*(?:years|yrs|y)\\s+(?:of\\s+)?(?:experience\\s+(?:in|with)\\s+)?${escaped}`, 'i'),
    new RegExp(`${escaped}.{0,40}?(\\d+(?:\\.\\d+)?)\\+?\\s*(?:years|yrs|y)`, 'i'),
  ]
    .map((pattern) => text.match(pattern)?.[1])
    .filter(Boolean)
    .map(Number)

  if (nearbyYears.length) return roundYears(Math.max(...nearbyYears))
  if (totalYearsExperience > 0) return roundYears(Math.min(totalYearsExperience, 5))
  return 1
}

function extractExplicitYears(text: string) {
  const matches = [
    ...text.matchAll(/(\d+(?:\.\d+)?)\+?\s*(?:years|yrs)\s+(?:of\s+)?(?:professional\s+)?experience/gi),
    ...text.matchAll(/experience\s*:?\s*(\d+(?:\.\d+)?)\+?\s*(?:years|yrs)/gi),
  ]
  const years = matches.map((match) => Number(match[1])).filter((value) => Number.isFinite(value))
  return years.length ? Math.max(...years) : 0
}

function extractExperience(text: string): CvExperience[] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const entries: CvExperience[] = []
  const seen = new Set<string>()

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!roleWords.test(line)) continue

    const windowText = [line, lines[index + 1], lines[index + 2]].filter(Boolean).join(' ')
    const range = parseDateRange(windowText)
    if (!range) continue

    const title = extractTitle(line)
    const company = extractCompany(line, lines[index + 1])
    const key = `${title}:${company}:${range.startDate}:${range.endDate ?? 'present'}`
    if (seen.has(key)) continue

    seen.add(key)
    entries.push({
      title,
      company,
      startDate: range.startDate,
      endDate: range.endDate,
      isCurrent: range.isCurrent,
      totalMonths: range.totalMonths,
    })
  }

  return entries.slice(0, 12)
}

function parseDateRange(text: string) {
  const datePattern =
    '(?:(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\\s+)?\\d{4}'
  const rangePattern = new RegExp(`(${datePattern})\\s*(?:-|–|—|to|through)\\s*(${datePattern}|present|current|now)`, 'i')
  const match = text.match(rangePattern)
  if (!match) return null

  const start = parseMonthYear(match[1])
  const isCurrent = /present|current|now/i.test(match[2])
  const end = isCurrent ? new Date() : parseMonthYear(match[2])
  if (!start || !end || end < start) return null

  const totalMonths = Math.max(1, monthDiff(start, end))
  return {
    startDate: toYearMonth(start),
    endDate: isCurrent ? null : toYearMonth(end),
    isCurrent,
    totalMonths,
  }
}

function parseMonthYear(value: string) {
  const parts = value.toLowerCase().trim().split(/\s+/)
  const year = Number(parts[parts.length - 1])
  if (!Number.isFinite(year)) return null
  const month = parts.length > 1 ? monthIndexes[parts[0]] ?? 0 : 0
  return new Date(year, month, 1)
}

function monthDiff(start: Date, end: Date) {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1
}

function toYearMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function extractTitle(line: string) {
  const beforeSeparator = line.split(/\s+[-–—|@]\s+/)[0]?.trim()
  return beforeSeparator && roleWords.test(beforeSeparator) ? beforeSeparator.slice(0, 90) : line.slice(0, 90)
}

function extractCompany(line: string, nextLine?: string) {
  const atMatch = line.match(/\s(?:at|@)\s([^|,–—-]+)/i)
  if (atMatch?.[1]) return atMatch[1].trim().slice(0, 90)
  const parts = line.split(/\s+[-–—|]\s+/)
  if (parts[1] && !/\d{4}/.test(parts[1])) return parts[1].trim().slice(0, 90)
  if (nextLine && !roleWords.test(nextLine) && !/\d{4}/.test(nextLine)) return nextLine.trim().slice(0, 90)
  return 'Unknown company'
}

function extractEducation(text: string) {
  const lines = text.split('\n').map((line) => line.trim())
  return lines
    .filter((line) => /\b(bachelor|master|phd|degree|university|college|bs|ms|bsc|msc|mba)\b/i.test(line))
    .slice(0, 8)
}

function extractCertifications(text: string) {
  const lines = text.split('\n').map((line) => line.trim())
  return lines
    .filter((line) => /(certified|certification|certificate|aws certified|scrum master|pmp|ccna|security\+)/i.test(line))
    .slice(0, 8)
}

function roundYears(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.round(value * 10) / 10
}
