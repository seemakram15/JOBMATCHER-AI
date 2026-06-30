import type { RemotePreference, UserProfile } from '../types'

const emptyMeaning = new Set(['none', 'n/a', 'na', 'no', 'nothing', 'not applicable'])

export function splitPreferenceText(value: string, limit = 30) {
  const seen = new Set<string>()
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, limit)
}

export function joinPreferenceText(values: string[] | undefined) {
  return (values || []).join(', ')
}

export function usefulPreferenceTerms(values: string[] | undefined) {
  return (values || []).filter((value) => !emptyMeaning.has(value.trim().toLowerCase()))
}

export function isProfileComplete(profile: UserProfile) {
  return getProfileCompletion(profile).isComplete
}

export function getProfileCompletion(profile: UserProfile) {
  const missing = profile.profileCompletedAt ? [] : ['Profile completed checkbox']

  return {
    missing,
    isComplete: Boolean(profile.profileCompletedAt),
  }
}

export function normaliseRemotePreference(value: unknown): RemotePreference {
  return value === 'hybrid' || value === 'onsite' || value === 'any' || value === 'remote' ? value : 'remote'
}

export function profileSearchSkills(profile: UserProfile, cvSkills: string[]) {
  return [...usefulPreferenceTerms(profile.mustHaveSkills), ...cvSkills].filter(Boolean)
}

export function profileSearchLocation(profile: UserProfile) {
  const city = usefulPreferenceTerms(profile.preferredCities)[0]
  const country = usefulPreferenceTerms(profile.preferredCountries)[0]
  if (!country || country === 'Remote') return 'Remote'
  if (!city || city === 'Any city' || city === 'Remote') return country
  return `${city}, ${country}`
}
