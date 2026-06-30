export type UserRole = 'job_seeker' | 'admin'
export type WorkMode = 'remote' | 'hybrid' | 'onsite'
export type RemotePreference = WorkMode | 'any'
export type JobType = 'full_time' | 'part_time' | 'contract' | 'freelance' | 'internship'
export type ExperienceLevel = 'entry' | 'mid' | 'senior' | 'lead' | 'executive'
export type ApplicationStatus =
  | 'saved'
  | 'applied'
  | 'interviewing'
  | 'offer'
  | 'rejected'
  | 'withdrawn'
  | 'archived'

export interface UserProfile {
  id: string
  email: string
  name: string
  role: UserRole
  headline: string
  location: string
  targetRole: string
  targetRoles: string[]
  mustHaveSkills: string[]
  avoidKeywords: string[]
  preferredCountries: string[]
  preferredCities: string[]
  remotePreference: RemotePreference
  preferredRemote: boolean
  minimumSalary: number
  experienceYears: number
  goodJobExamples: string[]
  badJobExamples: string[]
  profileCompletedAt: string | null
  salaryMin: number
  salaryMax: number
  currency: string
  activeCvId: string
}

export interface CvSkill {
  skillName: string
  skillCanonical: string
  skillType: 'technical' | 'soft' | 'language' | 'tool' | 'framework' | 'certification'
  yearsUsed: number
  skillRank: number
  confidence: 'high' | 'medium' | 'low'
  isManual?: boolean
}

export interface CvExperience {
  title: string
  company: string
  startDate: string
  endDate: string | null
  isCurrent: boolean
  totalMonths: number
}

export interface CvProfile {
  id: string
  label: string
  filename: string
  version: number
  isActive: boolean
  parseStatus: 'pending' | 'processing' | 'done' | 'failed'
  parsedAt: string | null
  skills: CvSkill[]
  experience: CvExperience[]
  totalYearsExperience: number
}

export interface ParsedCvPayload {
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

export interface SkillRequirement {
  skill: string
  required: boolean
  weight: number
}

export interface Job {
  id: string
  title: string
  company: string
  companyLogo?: string
  location: string
  country: string
  city: string
  isRemote: boolean
  workMode: WorkMode
  description: string
  descriptionHtml: string
  salaryMin?: number
  salaryMax?: number
  salaryCurrency: string
  jobType: JobType
  experienceMin?: number
  experienceMax?: number
  level: ExperienceLevel
  skillsRequired: SkillRequirement[]
  applyUrl: string
  sourcePlatform: string
  postedAt: string
  fetchedAt: string
}

export interface JobMatch {
  totalScore: number
  skillScore: number
  experienceScore: number
  titleScore: number
  locationScore: number
  recencyBonus: number
  matchedSkills: string[]
  missingSkills: string[]
  matchSummary: string
}

export interface ScoredJob {
  job: Job
  match: JobMatch
  isSaved: boolean
}

export interface ApplicationHistoryItem {
  oldStatus: ApplicationStatus | null
  newStatus: ApplicationStatus
  note: string
  changedAt: string
}

export interface Application {
  id: string
  jobId: string
  cvId: string
  status: ApplicationStatus
  notes: string
  reminderDate?: string
  appliedAt?: string
  lastUpdated: string
  createdAt: string
  history: ApplicationHistoryItem[]
}

export interface DashboardActivity {
  date: string
  jobsViewed: number
  jobsApplied: number
}

export interface SkillDemand {
  skill: string
  userHas: boolean
  marketDemandPct: number
}

export interface NotificationItem {
  id: string
  type: 'new_match' | 'job_expiry' | 'follow_up_reminder' | 'system' | 'new_source'
  title: string
  message: string
  actionUrl?: string
  isRead: boolean
  createdAt: string
}

export interface JobSource {
  id: number
  name: string
  url: string
  method: 'api' | 'rss' | 'apify' | 'serpapi'
  cronExpression: string
  isActive: boolean
  priority: number
  lastRunAt: string
  lastRunStatus: 'success' | 'failed' | 'running'
  jobsFetched: number
  jobsNew: number
  consecutiveFailures: number
}

export interface LiveJobSourceResult {
  name: string
  count: number
  ok: boolean
  error?: string
}

export interface JobFilters {
  search: string
  scoreMin: number
  workModes: WorkMode[]
  jobTypes: JobType[]
  levels: ExperienceLevel[]
  sources: string[]
  datePosted: 'any' | 'today' | '3days' | 'week' | 'month'
  salaryMin: number
  sort: 'score' | 'date' | 'salary' | 'company'
}
