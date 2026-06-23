import type { CvProfile, JobFilters, UserProfile } from '../types'

export const defaultFilters: JobFilters = {
  search: '',
  scoreMin: 0,
  workModes: [],
  jobTypes: [],
  levels: [],
  sources: [],
  datePosted: 'month',
  salaryMin: 0,
  sort: 'score',
}

export const emptyCv: CvProfile = {
  id: '',
  label: 'No CV uploaded yet',
  filename: 'Upload a CV or add skills manually',
  version: 0,
  isActive: true,
  parseStatus: 'pending',
  parsedAt: null,
  skills: [],
  experience: [],
  totalYearsExperience: 0,
}

export function createEmptyProfile(input: { id?: string; email?: string; name?: string } = {}): UserProfile {
  const email = input.email || ''
  const inferredName = input.name || email.split('@')[0] || 'Jobmatcher user'

  return {
    id: input.id || '',
    email,
    name: inferredName,
    role: 'job_seeker',
    headline: '',
    location: 'Remote',
    targetRole: 'Software Engineer',
    preferredRemote: true,
    salaryMin: 0,
    salaryMax: 0,
    currency: 'USD',
    activeCvId: '',
  }
}
