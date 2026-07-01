import { create } from 'zustand'
import { defaultFilters, emptyCv, createEmptyProfile } from '../lib/defaults'
import { hasSupabaseConfig, requireSupabase, supabase } from '../lib/supabase'
import { getUserWorkspace } from '../lib/adminClient'
import { scoreJobs } from '../lib/scoring'
import {
  activateCvInDb,
  clearCvDataForUser,
  deleteCvForUser,
  deleteApplication,
  ensureManualCv,
  fetchWorkspace,
  markNotificationsRead,
  persistApplication,
  persistLiveJobs,
  persistUserJobScores,
  replaceCvExperience,
  replaceCvSkills,
  saveParsedCv,
  updateUserProfile,
} from '../lib/workspacePersistence'
import type {
  Application,
  ApplicationStatus,
  CvExperience,
  CvProfile,
  CvSkill,
  ExperienceLevel,
  ImpersonationState,
  Job,
  JobFilters,
  JobType,
  LiveJobSourceResult,
  NotificationItem,
  ParsedCvPayload,
  UserProfile,
  WorkMode,
} from '../types'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error'
type WorkspaceStatus = 'idle' | 'loading' | 'ready' | 'error'

interface JobmatchState {
  authStatus: AuthStatus
  workspaceStatus: WorkspaceStatus
  authMessage: string
  recoveryMode: boolean
  userId: string | null
  profile: UserProfile
  cvs: CvProfile[]
  jobs: Job[]
  applications: Application[]
  notifications: NotificationItem[]
  filters: JobFilters
  selectedJobId: string
  activeCv: CvProfile
  savedJobIds: string[]
  searchedJobsCount: number
  lastLiveSearchAt: string | null
  liveJobSources: LiveJobSourceResult[]
  impersonation: ImpersonationState | null
  initializeAuth: () => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<{ confirmationRequired: boolean }>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (newPassword: string, currentPassword?: string) => Promise<void>
  clearRecoveryMode: () => void
  viewAsUser: (userId: string) => Promise<void>
  exitImpersonation: () => void
  setSelectedJob: (jobId: string) => void
  setFilters: (filters: Partial<JobFilters>) => void
  resetFilters: () => void
  toggleSave: (jobId: string) => void
  applyToJob: (jobId: string, notes?: string) => void
  updateApplicationStatus: (applicationId: string, status: ApplicationStatus) => void
  addCustomJobRecord: (input: CustomJobRecordInput) => void
  markAllNotificationsRead: () => void
  activateCv: (cvId: string) => void
  deleteCv: (cvId: string) => void
  clearCvData: () => void
  addParsedCv: (parsedCv: ParsedCvPayload) => void
  addManualSkills: (skills: string[], yearsUsed: number) => void
  upsertSkill: (skill: CvSkill, previousCanonical?: string) => void
  removeSkill: (skillCanonical: string) => void
  setActiveExperience: (years: number) => void
  replaceActiveExperience: (experience: CvExperience[], totalYears: number) => void
  updateProfile: (profile: Partial<UserProfile>) => void
  setLiveJobs: (jobs: Job[], sources: LiveJobSourceResult[]) => void
}

interface CustomJobRecordInput {
  title: string
  company: string
  location: string
  country: string
  city: string
  workMode: WorkMode
  jobType: JobType
  level: ExperienceLevel
  status: ApplicationStatus
  applyUrl: string
  description: string
  notes: string
  skills: string[]
  salaryMin: number
  salaryMax: number
  salaryCurrency: string
  experienceMin: number
  experienceMax: number
  reminderDate?: string
  sourcePlatform?: string
}

let authListenerStarted = false
let recoveryHandled = false

const legacyWorkspaceCacheKey = 'jobmatcher-workspace-cache-v1'

const timestamp = () => new Date().toISOString()

function isRecoveryUrl() {
  if (typeof window === 'undefined') return false
  const hash = window.location.hash || ''
  const search = window.location.search || ''
  return hash.includes('type=recovery') || new URLSearchParams(search).get('mode') === 'recovery'
}

function getAuthActionToken(): { type: 'recovery' | 'signup'; tokenHash: string } | null {
  if (typeof window === 'undefined') return null
  const searchParams = new URLSearchParams(window.location.search)
  const hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''))
  const type = searchParams.get('type') || hashParams.get('type')
  if (type !== 'recovery' && type !== 'signup') return null
  const tokenHash = searchParams.get('token_hash') || hashParams.get('token_hash') || ''
  if (!tokenHash) return null
  return { type, tokenHash }
}

function clearAuthTokenFromUrl(mode: string) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.set('mode', mode)
  url.searchParams.delete('type')
  url.searchParams.delete('token_hash')
  window.history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString()}`)
}

const emptyState = {
  authStatus: 'loading' as AuthStatus,
  workspaceStatus: 'idle' as WorkspaceStatus,
  authMessage: '',
  recoveryMode: false,
  userId: null,
  profile: createEmptyProfile(),
  cvs: [],
  jobs: [],
  applications: [],
  notifications: [],
  filters: defaultFilters,
  selectedJobId: '',
  activeCv: emptyCv,
  savedJobIds: [],
  searchedJobsCount: 0,
  lastLiveSearchAt: null,
  liveJobSources: [],
  impersonation: null,
}

const initialState = emptyState

export const useJobmatchStore = create<JobmatchState>((set) => ({
  ...initialState,
  initializeAuth: async () => {
    if (!hasSupabaseConfig || !supabase) {
      set({
        authStatus: 'error',
        authMessage: 'Supabase browser keys are missing. Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
        workspaceStatus: 'error',
      })
      return
    }
    clearWorkspaceCache()

    // Handle password-reset (recovery) and signup-confirmation links from email.
    // Guard against React StrictMode double-invoking this in dev, which would
    // verify (and consume) the single-use token twice — the second call fails.
    const actionToken = getAuthActionToken()
    if (actionToken && !recoveryHandled) {
      recoveryHandled = true
      const { error: verifyError } = await supabase.auth.verifyOtp({
        type: actionToken.type,
        token_hash: actionToken.tokenHash,
      })

      if (actionToken.type === 'recovery') {
        clearAuthTokenFromUrl('recovery')
        if (verifyError) {
          set({
            authStatus: 'error',
            authMessage: 'This reset link is invalid or expired. Please request a new password reset email.',
            workspaceStatus: 'idle',
            recoveryMode: false,
          })
          return
        }
        // Recovery session established — force the set-new-password screen.
        set({ authStatus: 'unauthenticated', workspaceStatus: 'idle', authMessage: '', recoveryMode: true })
      } else {
        // Signup confirmation.
        clearAuthTokenFromUrl('signin')
        if (verifyError) {
          set({
            authStatus: 'unauthenticated',
            authMessage: 'This confirmation link is invalid or expired. Please sign in, or create your account again.',
            workspaceStatus: 'idle',
          })
          return
        }
        // Email confirmed — a session now exists; fall through to load the workspace.
      }
    }

    const recovering = isRecoveryUrl()

    const { data, error } = await supabase.auth.getSession()
    if (error) {
      set({ authStatus: 'error', authMessage: error.message, workspaceStatus: 'error' })
      return
    }

    const user = data.session?.user
    if (recovering && user) {
      // A password-recovery link established a session. Keep the user on the
      // "set a new password" screen instead of loading the workspace.
      set({ authStatus: 'unauthenticated', workspaceStatus: 'idle', authMessage: '', recoveryMode: true })
    } else if (user) {
      await loadWorkspaceForUser(user.id, user.email || '')
    } else {
      resetWorkspace(set, 'unauthenticated')
    }

    if (!authListenerStarted) {
      authListenerStarted = true
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          useJobmatchStore.setState({
            authStatus: 'unauthenticated',
            workspaceStatus: 'idle',
            authMessage: '',
            recoveryMode: true,
          })
          return
        }

        const nextUser = session?.user
        if (!nextUser) {
          resetWorkspace(set, 'unauthenticated')
          return
        }

        // While the recovery screen is open, ignore the recovery session so the
        // user is not redirected into the workspace before setting a new password.
        if (useJobmatchStore.getState().recoveryMode) {
          return
        }

        const state = useJobmatchStore.getState()
        const isSameUser = state.userId === nextUser.id || state.profile.id === nextUser.id

        if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || isSameUser) {
          useJobmatchStore.setState({
            authStatus: 'authenticated',
            userId: nextUser.id,
            profile: isSameUser
              ? { ...state.profile, id: nextUser.id, email: nextUser.email || state.profile.email }
              : state.profile,
          })
          return
        }

        void loadWorkspaceForUser(nextUser.id, nextUser.email || '')
      })
    }
  },
  signUp: async (email, password, name) => {
    const client = requireSupabase()
    set({ authStatus: 'loading', authMessage: '' })

    const response = await fetch('/api/auth-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    })

    const payload = (await response.json()) as { error?: { message: string }; confirmationRequired?: boolean }
    if (!response.ok) {
      const message = payload.error?.message || 'Signup failed.'
      set({ authStatus: 'error', authMessage: message })
      throw new Error(message)
    }

    // When the server emailed a confirmation link, do NOT sign in — the account
    // is inactive until the user clicks the link.
    if (payload.confirmationRequired) {
      set({ authStatus: 'unauthenticated', authMessage: '' })
      return { confirmationRequired: true }
    }

    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (error) {
      set({ authStatus: 'error', authMessage: error.message })
      throw error
    }
    if (data.user) await loadWorkspaceForUser(data.user.id, data.user.email || email)
    return { confirmationRequired: false }
  },
  signIn: async (email, password) => {
    const client = requireSupabase()
    set({ authStatus: 'loading', authMessage: '' })
    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (error) {
      set({ authStatus: 'error', authMessage: error.message })
      throw error
    }
    if (data.user) await loadWorkspaceForUser(data.user.id, data.user.email || email)
  },
  signOut: async () => {
    if (supabase) await supabase.auth.signOut()
    resetWorkspace(set, 'unauthenticated')
  },
  requestPasswordReset: async (email) => {
    const response = await fetch('/api/password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      const message = payload?.error?.message || 'Could not send the reset email.'
      throw new Error(message)
    }
  },
  updatePassword: async (newPassword, currentPassword) => {
    const client = requireSupabase()

    // Optionally re-authenticate to confirm the user knows their current password
    // (Supabase's updateUser does not verify it on its own).
    if (currentPassword) {
      const email = useJobmatchStore.getState().profile.email
      if (!email) throw new Error('No account email on file to verify your current password.')
      const { error: verifyError } = await client.auth.signInWithPassword({ email, password: currentPassword })
      if (verifyError) throw new Error('Current password is incorrect.')
    }

    const { error } = await client.auth.updateUser({ password: newPassword })
    if (error) throw error
  },
  clearRecoveryMode: () => set({ recoveryMode: false }),
  viewAsUser: async (userId) => {
    const snapshot = await getUserWorkspace(userId)
    set({
      impersonation: {
        userId,
        email: snapshot.profile.email,
        name: snapshot.profile.name,
        snapshot,
      },
    })
  },
  exitImpersonation: () => set({ impersonation: null }),
  setSelectedJob: (jobId) => set({ selectedJobId: jobId }),
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  resetFilters: () => set({ filters: defaultFilters }),
  toggleSave: (jobId) =>
    set((state) => {
      const existing = state.applications.find((application) => application.jobId === jobId)
      const isSaved = state.savedJobIds.includes(jobId)
      const job = state.jobs.find((item) => item.id === jobId)

      if (isSaved && existing) {
        void deleteApplication(existing.id).catch((error) => addPersistenceWarning(error))
        return {
          savedJobIds: state.savedJobIds.filter((id) => id !== jobId),
          applications: state.applications.filter((application) => application.id !== existing.id),
        }
      }

      const nextApplication = existing
        ? updateApplication(existing, 'saved', 'Saved from discovery')
        : createApplication(state, jobId, 'saved', 'Saved from discovery.')

      const persistJob = job ? persistLiveJobs([job]) : Promise.resolve()
      void persistJob
        .then(() =>
          persistApplication({
            application: nextApplication,
            userId: state.profile.id,
            previousStatus: existing?.status ?? null,
          }),
        )
        .catch((error) => addPersistenceWarning(error))

      return {
        savedJobIds: Array.from(new Set([...state.savedJobIds, jobId])),
        applications: existing
          ? state.applications.map((application) => (application.id === existing.id ? nextApplication : application))
          : [nextApplication, ...state.applications],
      }
    }),
  applyToJob: (jobId, notes = 'Applied from Jobmatcher discovery flow.') =>
    set((state) => {
      const existing = state.applications.find((application) => application.jobId === jobId)
      const job = state.jobs.find((item) => item.id === jobId)
      const nextApplication = existing
        ? updateApplication(existing, 'applied', 'Application recorded', notes)
        : createApplication(state, jobId, 'applied', notes)

      const persistJob = job ? persistLiveJobs([job]) : Promise.resolve()
      void persistJob
        .then(() =>
          persistApplication({
            application: nextApplication,
            userId: state.profile.id,
            previousStatus: existing?.status ?? null,
          }),
        )
        .catch((error) => addPersistenceWarning(error))

      return {
        applications: existing
          ? state.applications.map((application) => (application.id === existing.id ? nextApplication : application))
          : [nextApplication, ...state.applications],
        savedJobIds: state.savedJobIds.filter((id) => id !== jobId),
      }
    }),
  updateApplicationStatus: (applicationId, status) =>
    set((state) => {
      const existing = state.applications.find((application) => application.id === applicationId)
      if (!existing) return state
      const nextApplication = updateApplication(existing, status, 'Status moved on tracker')
      void persistApplication({
        application: nextApplication,
        userId: state.profile.id,
        previousStatus: existing.status,
      }).catch((error) => addPersistenceWarning(error))

      return {
        applications: state.applications.map((application) =>
          application.id === applicationId ? nextApplication : application,
        ),
        savedJobIds:
          status === 'saved'
            ? Array.from(new Set([...state.savedJobIds, nextApplication.jobId]))
            : state.savedJobIds.filter((id) => id !== nextApplication.jobId),
      }
    }),
  addCustomJobRecord: (input) =>
    set((state) => {
      if (!state.profile.id) return state
      const now = timestamp()
      const jobId = createUuid()
      const applicationId = createUuid()
      const title = input.title.trim() || 'Custom job'
      const company = input.company.trim() || 'Company'
      const location = input.location.trim() || [input.city, input.country].filter(Boolean).join(', ') || 'Remote'
      const country = input.country.trim() || (location.toLowerCase() === 'remote' ? 'Remote' : '')
      const city = input.city.trim() || (location.toLowerCase() === 'remote' ? 'Remote' : '')
      const cleanSkills = input.skills.map((skill) => skill.trim()).filter(Boolean).slice(0, 30)
      const applyUrl = input.applyUrl.trim() || `https://www.google.com/search?q=${encodeURIComponent(`${title} ${company} job`)}`
      const job: Job = {
        id: jobId,
        title,
        company,
        companyLogo: company.slice(0, 2).toUpperCase(),
        location,
        country: country || location,
        city: city || location,
        isRemote: input.workMode === 'remote',
        workMode: input.workMode,
        description: input.description.trim() || input.notes.trim() || `Manually added ${title} role at ${company}.`,
        descriptionHtml: input.description.trim() || input.notes.trim() || `Manually added ${title} role at ${company}.`,
        salaryMin: input.salaryMin || undefined,
        salaryMax: input.salaryMax || undefined,
        salaryCurrency: /^[A-Z]{3}$/.test(input.salaryCurrency) ? input.salaryCurrency : state.profile.currency || 'USD',
        jobType: input.jobType,
        experienceMin: input.experienceMin || undefined,
        experienceMax: input.experienceMax || undefined,
        level: input.level,
        skillsRequired: cleanSkills.map((skill) => ({ skill, required: true, weight: 1 })),
        applyUrl,
        sourcePlatform: input.sourcePlatform?.trim() || 'Manual',
        postedAt: now,
        fetchedAt: now,
      }
      const application: Application = {
        id: applicationId,
        jobId,
        cvId: state.activeCv.id,
        status: input.status,
        notes: input.notes.trim(),
        reminderDate: input.reminderDate || undefined,
        appliedAt: input.status === 'applied' ? now : undefined,
        createdAt: now,
        lastUpdated: now,
        history: [
          {
            oldStatus: null,
            newStatus: input.status,
            note: input.sourcePlatform?.trim()
              ? `Custom job record added from ${input.sourcePlatform.trim()}`
              : 'Custom job record added from tracker',
            changedAt: now,
          },
        ],
      }

      void persistLiveJobs([job])
        .then(() =>
          persistApplication({
            application,
            userId: state.profile.id,
            previousStatus: null,
          }),
        )
        .catch((error) => addPersistenceWarning(error))

      return {
        jobs: [job, ...state.jobs.filter((item) => item.id !== job.id)],
        applications: [application, ...state.applications],
        savedJobIds:
          input.status === 'saved'
            ? Array.from(new Set([...state.savedJobIds, jobId]))
            : state.savedJobIds.filter((id) => id !== jobId),
        selectedJobId: jobId,
        notifications: [
          {
            id: createUuid(),
            type: 'system',
            title: 'Custom job added',
            message: `${title} at ${company} was added to your application tracker.`,
            actionUrl: '/tracker',
            isRead: false,
            createdAt: now,
          },
          ...state.notifications,
        ],
      }
    }),
  markAllNotificationsRead: () => {
    void markNotificationsRead().catch((error) => addPersistenceWarning(error))
    set((state) => ({
      notifications: state.notifications.map((notification) => ({ ...notification, isRead: true })),
    }))
  },
  activateCv: (cvId) =>
    set((state) => {
      const cvs = state.cvs.map((cv) => ({ ...cv, isActive: cv.id === cvId }))
      const activeCv = cvs.find((cv) => cv.id === cvId) ?? state.activeCv
      void activateCvInDb(state.profile.id, cvId).catch((error) => addPersistenceWarning(error))
      return {
        cvs,
        activeCv,
        profile: { ...state.profile, activeCvId: activeCv.id },
      }
    }),
  deleteCv: (cvId) =>
    set((state) => {
      if (!cvId) return state
      const deletingActiveCv = state.activeCv.id === cvId
      const remainingCvs = state.cvs.filter((cv) => cv.id !== cvId)
      const nextActiveCv = deletingActiveCv ? remainingCvs[0] ?? emptyCv : state.activeCv
      const cvs = remainingCvs.map((cv) => ({ ...cv, isActive: cv.id === nextActiveCv.id }))

      void deleteCvForUser(state.profile.id, cvId)
        .then(() => {
          if (nextActiveCv.id) return activateCvInDb(state.profile.id, nextActiveCv.id)
          return Promise.resolve()
        })
        .catch((error) => addPersistenceWarning(error))

      return {
        cvs,
        activeCv: nextActiveCv.id ? { ...nextActiveCv, isActive: true } : emptyCv,
        profile: { ...state.profile, activeCvId: nextActiveCv.id },
        jobs: deletingActiveCv ? [] : state.jobs,
        selectedJobId: deletingActiveCv ? '' : state.selectedJobId,
        searchedJobsCount: deletingActiveCv ? 0 : state.searchedJobsCount,
        lastLiveSearchAt: deletingActiveCv ? null : state.lastLiveSearchAt,
        liveJobSources: deletingActiveCv ? [] : state.liveJobSources,
        notifications: [
          {
            id: createUuid(),
            type: 'system',
            title: 'CV data removed',
            message: 'The selected CV profile, skills, experience, and match scores were removed from your account.',
            isRead: false,
            createdAt: timestamp(),
          },
          ...state.notifications,
        ],
      }
    }),
  clearCvData: () =>
    set((state) => {
      void clearCvDataForUser(state.profile.id).catch((error) => addPersistenceWarning(error))

      return {
        cvs: [],
        activeCv: emptyCv,
        profile: { ...state.profile, activeCvId: '' },
        jobs: [],
        selectedJobId: '',
        searchedJobsCount: 0,
        lastLiveSearchAt: null,
        liveJobSources: [],
        notifications: [
          {
            id: createUuid(),
            type: 'system',
            title: 'All CV data cleared',
            message: 'All CV profiles, extracted skills, experience, and CV-based match scores were removed from your account.',
            isRead: false,
            createdAt: timestamp(),
          },
          ...state.notifications,
        ],
      }
    }),
  addParsedCv: (parsedCv) =>
    set((state) => {
      const cv: CvProfile = {
        id: createUuid(),
        label: parsedCv.label || 'Uploaded CV',
        filename: parsedCv.filename,
        version: state.cvs.length + 1,
        isActive: true,
        parseStatus: 'done',
        parsedAt: timestamp(),
        skills: parsedCv.skills,
        experience: parsedCv.experience,
        totalYearsExperience: parsedCv.totalYearsExperience,
      }
      const cvs = state.cvs.map((item) => ({ ...item, isActive: false }))
      void saveParsedCv(state.profile.id, cv).catch((error) => addPersistenceWarning(error))

      return {
        cvs: [cv, ...cvs],
        activeCv: cv,
        profile: { ...state.profile, activeCvId: cv.id },
        notifications: [
          {
            id: createUuid(),
            type: 'system',
            title: 'CV parsed locally',
            message: `${parsedCv.skills.length} skills and ${parsedCv.totalYearsExperience} years of experience were extracted.`,
            isRead: false,
            createdAt: timestamp(),
          },
          ...state.notifications,
        ],
      }
    }),
  addManualSkills: (skills, yearsUsed) =>
    set((state) => {
      const cleaned = skills.map((skill) => skill.trim()).filter(Boolean)
      const activeCv = ensureActiveCv(state)
      const nextSkills = [
        ...activeCv.skills,
        ...cleaned
          .filter(
            (skill) =>
              !activeCv.skills.some((existing) => existing.skillCanonical.toLowerCase() === skill.toLowerCase()),
          )
          .map((skill) => ({
            skillName: skill,
            skillCanonical: skill,
            skillType: 'technical' as const,
            yearsUsed,
            skillRank: 76,
            confidence: 'high' as const,
            isManual: true,
          })),
      ]
      const nextCv = {
        ...activeCv,
        skills: nextSkills,
        totalYearsExperience: Math.max(activeCv.totalYearsExperience, yearsUsed),
      }
      void ensureManualCv(state.profile.id, nextCv)
        .then(() => replaceCvSkills(nextCv.id, nextCv.skills))
        .then(() => replaceCvExperience(nextCv.id, nextCv.experience, nextCv.totalYearsExperience))
        .catch((error) => addPersistenceWarning(error))

      return setActiveCvInState(state, nextCv)
    }),
  upsertSkill: (skill, previousCanonical) =>
    set((state) => {
      const activeCv = ensureActiveCv(state)
      const cleaned = cleanSkill(skill)
      if (!cleaned.skillName) return state
      const previousKey = normaliseSkillKey(previousCanonical || cleaned.skillCanonical)
      const cleanedKey = normaliseSkillKey(cleaned.skillCanonical)
      const existingIndex = activeCv.skills.findIndex((item) => normaliseSkillKey(item.skillCanonical) === previousKey)
      const duplicateIndex = activeCv.skills.findIndex((item) => normaliseSkillKey(item.skillCanonical) === cleanedKey)
      const nextSkills = [...activeCv.skills]

      if (existingIndex >= 0) {
        if (duplicateIndex >= 0 && duplicateIndex !== existingIndex) {
          nextSkills.splice(existingIndex, 1)
          nextSkills[duplicateIndex] = { ...nextSkills[duplicateIndex], ...cleaned }
        } else {
          nextSkills[existingIndex] = { ...nextSkills[existingIndex], ...cleaned }
        }
      } else if (duplicateIndex >= 0) {
        nextSkills[duplicateIndex] = { ...nextSkills[duplicateIndex], ...cleaned }
      } else {
        nextSkills.unshift(cleaned)
      }

      const nextCv = { ...activeCv, skills: nextSkills }
      void persistActiveCvSkills(state.profile.id, nextCv)
      return setActiveCvInState(state, nextCv)
    }),
  removeSkill: (skillCanonical) =>
    set((state) => {
      const activeCv = ensureActiveCv(state)
      const key = normaliseSkillKey(skillCanonical)
      const nextCv = {
        ...activeCv,
        skills: activeCv.skills.filter((skill) => normaliseSkillKey(skill.skillCanonical) !== key),
      }
      void persistActiveCvSkills(state.profile.id, nextCv)
      return setActiveCvInState(state, nextCv)
    }),
  setActiveExperience: (years) =>
    set((state) => {
      const activeCv = ensureActiveCv(state)
      const nextCv = { ...activeCv, totalYearsExperience: years }
      void ensureManualCv(state.profile.id, nextCv)
        .then(() => replaceCvExperience(nextCv.id, nextCv.experience, years))
        .catch((error) => addPersistenceWarning(error))
      return setActiveCvInState(state, nextCv)
    }),
  replaceActiveExperience: (experience, totalYears) =>
    set((state) => {
      const activeCv = ensureActiveCv(state)
      const nextCv = { ...activeCv, experience, totalYearsExperience: totalYears }
      void ensureManualCv(state.profile.id, nextCv)
        .then(() => replaceCvExperience(nextCv.id, experience, totalYears))
        .catch((error) => addPersistenceWarning(error))
      return setActiveCvInState(state, nextCv)
    }),
  updateProfile: (profilePatch) =>
    set((state) => {
      const profile = { ...state.profile, ...profilePatch }
      void updateUserProfile(profile).catch((error) => addPersistenceWarning(error))
      return { profile }
    }),
  setLiveJobs: (jobs, sources) =>
    set((state) => {
      void persistLiveJobs(jobs)
        .then(() => persistUserJobScores(state.profile.id, state.activeCv.id, scoreJobs(state.profile, state.activeCv, jobs, state.savedJobIds)))
        .catch((error) => addPersistenceWarning(error))
      return {
        jobs,
        searchedJobsCount: jobs.length,
        liveJobSources: sources,
        lastLiveSearchAt: timestamp(),
        selectedJobId: jobs[0]?.id || '',
        filters: {
          ...state.filters,
          scoreMin: 0,
          workModes: [],
          jobTypes: [],
          sources: [],
          datePosted: 'month',
          search: '',
          sort: 'score',
        },
        notifications: [
          {
            id: createUuid(),
            type: 'new_match',
            title: 'Live jobs extracted',
            message: `${jobs.length} real jobs were fetched from ${
              sources.filter((source) => source.ok).map((source) => source.name).join(', ') || 'live sources'
            }.`,
            actionUrl: '/jobs',
            isRead: false,
            createdAt: timestamp(),
          },
          ...state.notifications,
        ],
      }
    }),
}))

export const selectScoredJobs = () => {
  const state = useJobmatchStore.getState()
  return scoreJobs(state.profile, state.activeCv, state.jobs, state.savedJobIds)
}

async function loadWorkspaceForUser(
  userId: string,
  email: string,
  options: { background?: boolean } = {},
) {
  const current = useJobmatchStore.getState()
  const isSameUser = current.userId === userId || current.profile.id === userId
  const shouldKeepCurrentWorkspace = Boolean(options.background || (isSameUser && hasWorkspaceSnapshot(current)))

  useJobmatchStore.setState({
    authStatus: 'authenticated',
    workspaceStatus: shouldKeepCurrentWorkspace ? current.workspaceStatus : 'loading',
    authMessage: '',
    userId,
    profile: shouldKeepCurrentWorkspace
      ? { ...current.profile, id: userId, email: email || current.profile.email }
      : createEmptyProfile({ id: userId, email }),
  })

  try {
    const client = requireSupabase()
    const { data } = await client.auth.getUser()
    if (!data.user) throw new Error('No authenticated user session.')
    const snapshot = await fetchWorkspace(data.user)
    useJobmatchStore.setState({
      ...snapshot,
      authStatus: 'authenticated',
      workspaceStatus: 'ready',
      authMessage: '',
      userId,
      selectedJobId: snapshot.jobs[0]?.id || '',
      savedJobIds: snapshot.applications
        .filter((application) => application.status === 'saved')
        .map((application) => application.jobId),
      searchedJobsCount: snapshot.jobs.length,
      filters: defaultFilters,
    })
  } catch (error) {
    if (shouldKeepCurrentWorkspace) {
      useJobmatchStore.setState({
        workspaceStatus: 'ready',
        authStatus: 'authenticated',
        authMessage: error instanceof Error ? error.message : 'Unable to refresh workspace.',
      })
      return
    }

    useJobmatchStore.setState({
      workspaceStatus: 'error',
      authStatus: 'error',
      authMessage: error instanceof Error ? error.message : 'Unable to load workspace.',
    })
  }
}

function resetWorkspace(
  set: (state: Partial<JobmatchState>) => void,
  authStatus: AuthStatus,
  authMessage = useJobmatchStore.getState().authMessage,
) {
  clearWorkspaceCache()
  set({
    ...emptyState,
    authStatus,
    workspaceStatus: authStatus === 'unauthenticated' ? 'idle' : 'error',
    authMessage,
  })
}

function hasWorkspaceSnapshot(state: Pick<JobmatchState, 'profile' | 'userId' | 'activeCv' | 'cvs' | 'jobs' | 'applications'>) {
  return Boolean(
    state.userId ||
      state.profile.id ||
      state.activeCv.id ||
      state.cvs.length ||
      state.jobs.length ||
      state.applications.length,
  )
}

function createApplication(
  state: JobmatchState,
  jobId: string,
  status: ApplicationStatus,
  notes: string,
): Application {
  const now = timestamp()
  return {
    id: createUuid(),
    jobId,
    cvId: state.activeCv.id,
    status,
    notes,
    appliedAt: status === 'applied' ? now : undefined,
    createdAt: now,
    lastUpdated: now,
    history: [{ oldStatus: null, newStatus: status, note: notes, changedAt: now }],
  }
}

function updateApplication(
  application: Application,
  status: ApplicationStatus,
  note: string,
  notes = application.notes,
): Application {
  const now = timestamp()
  return {
    ...application,
    status,
    notes,
    appliedAt: status === 'applied' && !application.appliedAt ? now : application.appliedAt,
    lastUpdated: now,
    history: [
      ...application.history,
      {
        oldStatus: application.status,
        newStatus: status,
        note,
        changedAt: now,
      },
    ],
  }
}

function ensureActiveCv(state: JobmatchState) {
  if (state.activeCv.id) return state.activeCv
  return {
    ...emptyCv,
    id: createUuid(),
    label: 'Manual profile',
    filename: 'manual-profile',
    version: state.cvs.length + 1,
    parseStatus: 'done' as const,
    parsedAt: timestamp(),
  }
}

function setActiveCvInState(state: JobmatchState, nextCv: CvProfile) {
  const exists = state.cvs.some((cv) => cv.id === nextCv.id)
  const cvs = exists
    ? state.cvs.map((cv) => (cv.id === nextCv.id ? { ...nextCv, isActive: true } : { ...cv, isActive: false }))
    : [{ ...nextCv, isActive: true }, ...state.cvs.map((cv) => ({ ...cv, isActive: false }))]

  return {
    activeCv: { ...nextCv, isActive: true },
    cvs,
    profile: { ...state.profile, activeCvId: nextCv.id },
  }
}

async function persistActiveCvSkills(userId: string, cv: CvProfile) {
  await ensureManualCv(userId, cv)
  await replaceCvSkills(cv.id, cv.skills)
}

function cleanSkill(skill: CvSkill): CvSkill {
  const skillName = skill.skillName.trim()
  const skillCanonical = (skill.skillCanonical || skillName).trim()
  const skillRank = Math.round(Math.min(Math.max(Number(skill.skillRank) || 0, 0), 100))

  return {
    skillName,
    skillCanonical,
    skillType: skill.skillType || 'technical',
    yearsUsed: Math.min(Math.max(Number(skill.yearsUsed) || 0, 0), 60),
    skillRank,
    confidence: rankToConfidence(skillRank),
    isManual: Boolean(skill.isManual),
  }
}

function rankToConfidence(rank: number): CvSkill['confidence'] {
  if (rank >= 78) return 'high'
  if (rank >= 45) return 'medium'
  return 'low'
}

function normaliseSkillKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ').trim()
}

function addPersistenceWarning(error: unknown) {
  const message = error instanceof Error ? error.message : 'A workspace save failed.'
  useJobmatchStore.setState((state) => ({
    notifications: [
      {
        id: createUuid(),
        type: 'system',
        title: 'Workspace save issue',
        message,
        isRead: false,
        createdAt: timestamp(),
      },
      ...state.notifications,
    ],
  }))
}

function createUuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()

  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (char) =>
    (Number(char) ^ (Math.random() * 16) >> (Number(char) / 4)).toString(16),
  )
}

function clearWorkspaceCache() {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(legacyWorkspaceCacheKey)
  } catch {
    // Ignore storage cleanup failures.
  }
}
