import type { User } from '@supabase/supabase-js'
import { emptyCv } from './defaults'
import {
  clampNumber,
  sanitiseApplication,
  sanitiseCvProfile,
  sanitiseExperience,
  sanitiseJob,
  sanitiseSkill,
  sanitiseText,
  sanitiseUrl,
  sanitiseUserProfile,
} from './security'
import { requireSupabase } from './supabase'
import type {
  Application,
  ApplicationStatus,
  CvExperience,
  CvProfile,
  CvSkill,
  Job,
  NotificationItem,
  ScoredJob,
  UserProfile,
} from '../types'

interface UserRow {
  id: string
  email: string
  name: string | null
  headline: string | null
  location: string | null
  target_role: string | null
  target_roles?: string[] | null
  must_have_skills?: string[] | null
  avoid_keywords?: string[] | null
  preferred_countries?: string[] | null
  preferred_cities?: string[] | null
  remote_preference?: UserProfile['remotePreference'] | null
  salary_min: number | null
  salary_max: number | null
  minimum_salary?: number | null
  experience_years?: number | null
  good_job_examples?: string[] | null
  bad_job_examples?: string[] | null
  profile_completed_at?: string | null
  currency: string | null
  preferred_remote: boolean | null
  role: 'job_seeker' | 'admin' | null
}

interface CvRow {
  id: string
  label: string | null
  filename: string
  version: number | null
  is_active: boolean | null
  parse_status: CvProfile['parseStatus']
  parsed_at: string | null
  total_years_experience: number | null
  cv_skills?: CvSkillRow[]
  cv_experience?: CvExperienceRow[]
}

interface CvSkillRow {
  skill_name: string
  skill_canonical: string | null
  skill_type: CvSkill['skillType'] | null
  years_used: number | null
  skill_rank?: number | null
  confidence: CvSkill['confidence'] | null
  is_manual: boolean | null
}

interface CvExperienceRow {
  title: string | null
  company: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean | null
  total_months: number | null
}

interface ApplicationRow {
  id: string
  job_id: string
  cv_id: string | null
  status: ApplicationStatus
  notes: string | null
  reminder_date: string | null
  applied_at: string | null
  last_updated: string
  created_at: string
  application_history?: {
    old_status: ApplicationStatus | null
    new_status: ApplicationStatus
    note: string | null
    changed_at: string
  }[]
}

interface NotificationRow {
  id: number
  type: NotificationItem['type']
  title: string
  message: string | null
  action_url: string | null
  is_read: boolean | null
  created_at: string
}

interface UserJobScoreRow {
  job_id: string
}

export interface WorkspaceSnapshot {
  profile: UserProfile
  cvs: CvProfile[]
  activeCv: CvProfile
  jobs: Job[]
  applications: Application[]
  notifications: NotificationItem[]
}

export async function ensureUserProfile(user: User) {
  const client = requireSupabase()
  const email = user.email || ''
  const name = stringMeta(user, 'full_name') || stringMeta(user, 'name') || email.split('@')[0] || 'Jobmatcher user'

  const { data: existing, error: readError } = await client
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<UserRow>()

  if (readError) throw readError
  if (existing) return mapUser(existing)

  const { data, error } = await client
    .from('users')
    .insert({
      id: user.id,
      email,
      name,
      role: 'job_seeker',
      location: 'Remote',
      target_role: '',
      target_roles: [],
      must_have_skills: [],
      avoid_keywords: [],
      preferred_countries: ['Remote'],
      preferred_cities: ['Remote'],
      remote_preference: 'remote',
      preferred_remote: true,
      salary_min: 0,
      salary_max: 0,
      minimum_salary: 0,
      experience_years: 0,
      good_job_examples: [],
      bad_job_examples: [],
      profile_completed_at: null,
      currency: 'USD',
    })
    .select('*')
    .single<UserRow>()

  if (error) throw error
  return mapUser(data)
}

export async function fetchWorkspace(user: User): Promise<WorkspaceSnapshot> {
  const client = requireSupabase()
  const profile = await ensureUserProfile(user)

  const [
    { data: cvRows, error: cvError },
    { data: appRows, error: appError },
    { data: notificationRows, error: notError },
    { data: scoreRows, error: scoreError },
  ] = await Promise.all([
      client
        .from('cvs')
        .select('*, cv_skills(*), cv_experience(*)')
        .eq('user_id', user.id)
        .order('version', { ascending: false }),
      client
        .from('applications')
        .select('*, application_history(*)')
        .eq('user_id', user.id)
        .order('last_updated', { ascending: false }),
      client.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
      client.from('user_job_scores').select('job_id').eq('user_id', user.id).order('computed_at', { ascending: false }).limit(100),
    ])

  if (cvError) throw cvError
  if (appError) throw appError
  if (notError) throw notError
  if (scoreError) throw scoreError

  const cvs = ((cvRows || []) as CvRow[]).map(mapCv)
  const activeCv = cvs.find((cv) => cv.isActive) ?? cvs[0] ?? emptyCv
  const applications = ((appRows || []) as ApplicationRow[]).map(mapApplication)
  const scoredJobIds = ((scoreRows || []) as UserJobScoreRow[]).map((row) => row.job_id)
  const jobIds = Array.from(new Set([...scoredJobIds, ...applications.map((application) => application.jobId)].filter(Boolean)))
  const jobs = jobIds.length ? await fetchJobs(jobIds) : []

  return {
    profile: { ...profile, activeCvId: activeCv.id },
    cvs,
    activeCv,
    jobs,
    applications,
    notifications: ((notificationRows || []) as NotificationRow[]).map(mapNotification),
  }
}

export async function updateUserProfile(profile: UserProfile) {
  const client = requireSupabase()
  const safe = sanitiseUserProfile(profile)
  const { error } = await client
    .from('users')
    .update({
      name: safe.name,
      headline: safe.headline,
      location: safe.location,
      target_role: safe.targetRole,
      target_roles: safe.targetRoles,
      must_have_skills: safe.mustHaveSkills,
      avoid_keywords: safe.avoidKeywords,
      preferred_countries: safe.preferredCountries,
      preferred_cities: safe.preferredCities,
      remote_preference: safe.remotePreference,
      preferred_remote: safe.preferredRemote,
      salary_min: safe.salaryMin,
      salary_max: safe.salaryMax,
      minimum_salary: safe.minimumSalary,
      experience_years: safe.experienceYears,
      good_job_examples: safe.goodJobExamples,
      bad_job_examples: safe.badJobExamples,
      profile_completed_at: safe.profileCompletedAt,
      currency: safe.currency,
    })
    .eq('id', safe.id)

  if (error) throw error
}

export async function saveParsedCv(userId: string, cv: CvProfile) {
  const client = requireSupabase()
  const safe = sanitiseCvProfile(cv)
  await client.from('cvs').update({ is_active: false }).eq('user_id', userId)

  const { error: cvError } = await client.from('cvs').upsert({
    id: safe.id,
    user_id: userId,
    label: safe.label,
    filename: safe.filename,
    storage_path: `${userId}/${safe.id}/${safe.filename}`,
    version: safe.version,
    is_active: true,
    parse_status: safe.parseStatus,
    parsed_at: safe.parsedAt,
    total_years_experience: safe.totalYearsExperience,
  })
  if (cvError) throw cvError

  await replaceCvSkills(safe.id, safe.skills)
  await replaceCvExperience(safe.id, safe.experience, safe.totalYearsExperience)
}

export async function ensureManualCv(userId: string, cv: CvProfile) {
  if (!cv.id) return
  const client = requireSupabase()
  const safe = sanitiseCvProfile(cv)
  const { error } = await client.from('cvs').upsert({
    id: safe.id,
    user_id: userId,
    label: safe.label,
    filename: safe.filename,
    storage_path: `${userId}/${safe.id}/manual-profile`,
    version: safe.version,
    is_active: true,
    parse_status: safe.parseStatus,
    parsed_at: safe.parsedAt,
    total_years_experience: safe.totalYearsExperience,
  })
  if (error) throw error
}

export async function activateCvInDb(userId: string, cvId: string) {
  const client = requireSupabase()
  await client.from('cvs').update({ is_active: false }).eq('user_id', userId)
  const { error } = await client.from('cvs').update({ is_active: true }).eq('id', cvId).eq('user_id', userId)
  if (error) throw error
}

export async function deleteCvForUser(userId: string, cvId: string) {
  if (!userId || !cvId) return
  const client = requireSupabase()
  const { data } = await client.auth.getUser()
  if (data.user?.id !== userId) throw new Error('Cannot delete CV data for another user.')

  const { error: scoreError } = await client
    .from('user_job_scores')
    .delete()
    .eq('user_id', userId)
    .eq('cv_id', cvId)
  if (scoreError) throw scoreError

  const { error } = await client.from('cvs').delete().eq('id', cvId).eq('user_id', userId)
  if (error) throw error
}

export async function clearCvDataForUser(userId: string) {
  if (!userId) return
  const client = requireSupabase()
  const { data } = await client.auth.getUser()
  if (data.user?.id !== userId) throw new Error('Cannot clear CV data for another user.')

  const { error: scoreError } = await client.from('user_job_scores').delete().eq('user_id', userId)
  if (scoreError) throw scoreError

  const { error } = await client.from('cvs').delete().eq('user_id', userId)
  if (error) throw error
}

export async function replaceCvSkills(cvId: string, skills: CvSkill[]) {
  if (!cvId) return
  const client = requireSupabase()
  const safeSkills = skills.map(sanitiseSkill).filter((skill) => skill.skillName)
  const { error: deleteError } = await client.from('cv_skills').delete().eq('cv_id', cvId)
  if (deleteError) throw deleteError
  if (!safeSkills.length) return

  const rows = safeSkills.map((skill) => ({
    cv_id: cvId,
    skill_name: skill.skillName,
    skill_canonical: skill.skillCanonical,
    skill_type: skill.skillType,
    years_used: skill.yearsUsed,
    skill_rank: skill.skillRank,
    confidence: skill.confidence,
    is_manual: Boolean(skill.isManual),
  }))

  const { error } = await client.from('cv_skills').insert(rows)
  if (error && /skill_rank/i.test(error.message)) {
    const { error: fallbackError } = await client.from('cv_skills').insert(
      rows.map((row) => ({
        cv_id: row.cv_id,
        skill_name: row.skill_name,
        skill_canonical: row.skill_canonical,
        skill_type: row.skill_type,
        years_used: row.years_used,
        confidence: row.confidence,
        is_manual: row.is_manual,
      })),
    )
    if (fallbackError) throw fallbackError
    return
  }
  if (error) throw error
}

export async function replaceCvExperience(cvId: string, experience: CvExperience[], totalYears: number) {
  if (!cvId) return
  const client = requireSupabase()
  const safeExperience = experience.map(sanitiseExperience).filter((item) => item.title || item.company || item.startDate)
  const safeTotalYears = clampNumber(totalYears, 0, 60, 0)
  const { error: cvError } = await client
    .from('cvs')
    .update({ total_years_experience: safeTotalYears })
    .eq('id', cvId)
  if (cvError) throw cvError

  const { error: deleteError } = await client.from('cv_experience').delete().eq('cv_id', cvId)
  if (deleteError) throw deleteError
  if (!safeExperience.length) return

  const { error } = await client.from('cv_experience').insert(
    safeExperience.map((item) => ({
      cv_id: cvId,
      title: item.title,
      company: item.company,
      start_date: normaliseDateForDb(item.startDate),
      end_date: item.endDate ? normaliseDateForDb(item.endDate) : null,
      is_current: item.isCurrent,
      total_months: item.totalMonths,
    })),
  )
  if (error) throw error
}

export async function persistLiveJobs(jobs: Job[]) {
  if (!jobs.length) return
  const client = requireSupabase()
  const safeJobs = jobs.map(sanitiseJob).filter((job) => job.title && job.applyUrl !== '#')
  if (!safeJobs.length) return
  const { error } = await client.from('jobs').upsert(
    safeJobs.map((job) => ({
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
  if (error) throw error
}

export async function persistUserJobScores(userId: string, cvId: string, scoredJobs: ScoredJob[]) {
  if (!scoredJobs.length) return
  const client = requireSupabase()
  const { error } = await client.from('user_job_scores').upsert(
    scoredJobs.map(({ job, match }) => ({
      user_id: userId,
      job_id: job.id,
      cv_id: cvId || null,
      total_score: match.totalScore,
      skill_score: match.skillScore,
      experience_score: match.experienceScore,
      title_score: match.titleScore,
      location_score: match.locationScore,
      recency_bonus: match.recencyBonus,
      matched_skills: match.matchedSkills,
      missing_skills: match.missingSkills,
      match_summary: match.matchSummary,
      computed_at: new Date().toISOString(),
    })),
    { onConflict: 'user_id,job_id,cv_id' },
  )
  if (error) throw error
}

export async function persistApplication(input: {
  application: Application
  userId: string
  previousStatus?: ApplicationStatus | null
}) {
  const client = requireSupabase()
  const { application, userId, previousStatus = null } = input
  const safe = sanitiseApplication(application)
  const { error } = await client.from('applications').upsert({
    id: safe.id,
    user_id: userId,
    job_id: safe.jobId,
    cv_id: safe.cvId || null,
    status: safe.status,
    notes: safe.notes,
    reminder_date: safe.reminderDate || null,
    applied_at: safe.appliedAt || null,
    last_updated: safe.lastUpdated,
    created_at: safe.createdAt,
  })
  if (error) throw error

  const lastHistory = safe.history[safe.history.length - 1]
  if (lastHistory) {
    await client.from('application_history').insert({
      application_id: safe.id,
      old_status: previousStatus,
      new_status: application.status,
      note: lastHistory.note,
      changed_at: lastHistory.changedAt,
      changed_by: userId,
    })
  }
}

export async function deleteApplication(applicationId: string) {
  const client = requireSupabase()
  const { error } = await client.from('applications').delete().eq('id', applicationId)
  if (error) throw error
}

export async function markNotificationsRead() {
  const client = requireSupabase()
  const { data } = await client.auth.getUser()
  const userId = data.user?.id
  if (!userId) return
  const { error } = await client.from('notifications').update({ is_read: true }).eq('user_id', userId)
  if (error) throw error
}

async function fetchJobs(jobIds: string[]) {
  const client = requireSupabase()
  const { data, error } = await client.from('jobs').select('*').in('id', jobIds)
  if (error) throw error
  return (data || []).map(mapJob)
}

function mapUser(row: UserRow): UserProfile {
  return sanitiseUserProfile({
    id: row.id,
    email: row.email,
    name: row.name || row.email.split('@')[0] || 'Jobmatcher user',
    role: row.role || 'job_seeker',
    headline: row.headline || '',
    location: row.location || 'Remote',
    targetRole: row.target_role || '',
    targetRoles: listFromJson(row.target_roles, row.target_role || undefined),
    mustHaveSkills: listFromJson(row.must_have_skills),
    avoidKeywords: listFromJson(row.avoid_keywords),
    preferredCountries: listFromJson(row.preferred_countries, row.location === 'Remote' ? 'Remote' : undefined),
    preferredCities: listFromJson(row.preferred_cities, row.location || 'Remote'),
    remotePreference: row.remote_preference || (row.preferred_remote ? 'remote' : 'onsite'),
    preferredRemote: Boolean(row.preferred_remote),
    minimumSalary: row.minimum_salary ?? row.salary_min ?? 0,
    experienceYears: row.experience_years ?? 0,
    goodJobExamples: listFromJson(row.good_job_examples),
    badJobExamples: listFromJson(row.bad_job_examples),
    profileCompletedAt: row.profile_completed_at || null,
    salaryMin: row.salary_min || 0,
    salaryMax: row.salary_max || 0,
    currency: row.currency || 'USD',
    activeCvId: '',
  })
}

function mapCv(row: CvRow): CvProfile {
  const skills = (row.cv_skills || []).map(mapSkill)
  const experience = (row.cv_experience || []).map(mapExperience)
  const durationYears = experience.reduce((total, item) => total + item.totalMonths, 0) / 12

  return sanitiseCvProfile({
    id: row.id,
    label: row.label || 'Uploaded CV',
    filename: row.filename,
    version: row.version || 1,
    isActive: Boolean(row.is_active),
    parseStatus: row.parse_status || 'done',
    parsedAt: row.parsed_at,
    skills,
    experience,
    totalYearsExperience: Number(row.total_years_experience ?? durationYears.toFixed(1)),
  })
}

function mapSkill(row: CvSkillRow): CvSkill {
  return {
    skillName: row.skill_name,
    skillCanonical: row.skill_canonical || row.skill_name,
    skillType: row.skill_type || 'technical',
    yearsUsed: Number(row.years_used || 0),
    skillRank: Number(row.skill_rank ?? rankFromLegacySkill(row.years_used, row.confidence)),
    confidence: row.confidence || 'medium',
    isManual: Boolean(row.is_manual),
  }
}

function rankFromLegacySkill(yearsUsed: number | null, confidence: CvSkill['confidence'] | null) {
  const base = confidence === 'high' ? 84 : confidence === 'medium' ? 68 : 50
  return Math.min(96, base + Math.min(12, Math.round(Number(yearsUsed || 0) * 2)))
}

function mapExperience(row: CvExperienceRow): CvExperience {
  return {
    title: row.title || 'Role',
    company: row.company || 'Company',
    startDate: row.start_date || '',
    endDate: row.end_date,
    isCurrent: Boolean(row.is_current),
    totalMonths: row.total_months || 0,
  }
}

function mapApplication(row: ApplicationRow): Application {
  return {
    id: row.id,
    jobId: row.job_id,
    cvId: row.cv_id || '',
    status: row.status,
    notes: row.notes || '',
    reminderDate: row.reminder_date || undefined,
    appliedAt: row.applied_at || undefined,
    lastUpdated: row.last_updated,
    createdAt: row.created_at,
    history: (row.application_history || []).map((item) => ({
      oldStatus: item.old_status,
      newStatus: item.new_status,
      note: item.note || '',
      changedAt: item.changed_at,
    })),
  }
}

function mapNotification(row: NotificationRow): NotificationItem {
  return {
    id: String(row.id),
    type: row.type,
    title: sanitiseText(row.title, 160),
    message: sanitiseText(row.message || '', 500),
    actionUrl: row.action_url ? sanitiseUrl(row.action_url, undefined) : undefined,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
  }
}

function mapJob(row: Record<string, unknown>): Job {
  return sanitiseJob({
    id: String(row.id),
    title: String(row.title || 'Untitled role'),
    company: String(row.company || 'Unknown company'),
    companyLogo: row.company_logo ? String(row.company_logo) : undefined,
    location: String(row.location || 'Remote'),
    country: String(row.country || 'Remote'),
    city: String(row.city || 'Remote'),
    isRemote: Boolean(row.is_remote),
    workMode: String(row.work_mode || 'remote') as Job['workMode'],
    description: String(row.description || ''),
    descriptionHtml: String(row.description_html || row.description || ''),
    salaryMin: optionalNumber(row.salary_min),
    salaryMax: optionalNumber(row.salary_max),
    salaryCurrency: String(row.salary_currency || 'USD'),
    jobType: String(row.job_type || 'full_time') as Job['jobType'],
    experienceMin: optionalNumber(row.experience_min),
    experienceMax: optionalNumber(row.experience_max),
    level: String(row.level || 'mid') as Job['level'],
    skillsRequired: Array.isArray(row.skills_required) ? (row.skills_required as Job['skillsRequired']) : [],
    applyUrl: String(row.apply_url || '#'),
    sourcePlatform: String(row.source_platform || 'Live source'),
    postedAt: String(row.posted_at || row.fetched_at || new Date().toISOString()),
    fetchedAt: String(row.fetched_at || new Date().toISOString()),
  })
}

function optionalNumber(value: unknown) {
  return value === null || value === undefined ? undefined : Number(value)
}

function listFromJson(value: unknown, fallback?: string) {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : []
  const output = values.map((item) => sanitiseText(item, 120)).filter(Boolean)
  if (output.length) return output
  return fallback ? [fallback] : []
}

function normaliseDateForDb(value: string) {
  if (!value) return null
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`
  return value
}

function stringMeta(user: User, key: string) {
  const value = user.user_metadata?.[key]
  return typeof value === 'string' ? value : ''
}
