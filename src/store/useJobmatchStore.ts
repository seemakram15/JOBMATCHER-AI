import { create } from 'zustand'
import { defaultFilters, emptyCv, createEmptyProfile } from '../lib/defaults'
import { hasSupabaseConfig, requireSupabase, supabase } from '../lib/supabase'
import { scoreJobs } from '../lib/scoring'
import {
  activateCvInDb,
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
  Job,
  JobFilters,
  LiveJobSourceResult,
  NotificationItem,
  ParsedCvPayload,
  UserProfile,
} from '../types'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error'
type WorkspaceStatus = 'idle' | 'loading' | 'ready' | 'error'

interface JobmatchState {
  authStatus: AuthStatus
  workspaceStatus: WorkspaceStatus
  authMessage: string
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
  initializeAuth: () => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  setSelectedJob: (jobId: string) => void
  setFilters: (filters: Partial<JobFilters>) => void
  resetFilters: () => void
  toggleSave: (jobId: string) => void
  applyToJob: (jobId: string, notes?: string) => void
  updateApplicationStatus: (applicationId: string, status: ApplicationStatus) => void
  markAllNotificationsRead: () => void
  activateCv: (cvId: string) => void
  addParsedCv: (parsedCv: ParsedCvPayload) => void
  addManualSkills: (skills: string[], yearsUsed: number) => void
  setActiveExperience: (years: number) => void
  replaceActiveExperience: (experience: CvExperience[], totalYears: number) => void
  updateProfile: (profile: Partial<Pick<UserProfile, 'targetRole' | 'location' | 'preferredRemote'>>) => void
  setLiveJobs: (jobs: Job[], sources: LiveJobSourceResult[]) => void
}

let authListenerStarted = false

const timestamp = () => new Date().toISOString()

const initialState = {
  authStatus: 'loading' as AuthStatus,
  workspaceStatus: 'idle' as WorkspaceStatus,
  authMessage: '',
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
}

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

    const { data, error } = await supabase.auth.getSession()
    if (error) {
      set({ authStatus: 'error', authMessage: error.message, workspaceStatus: 'error' })
      return
    }

    const user = data.session?.user
    if (user) {
      await loadWorkspaceForUser(user.id, user.email || '')
    } else {
      resetWorkspace(set, 'unauthenticated')
    }

    if (!authListenerStarted) {
      authListenerStarted = true
      supabase.auth.onAuthStateChange((_event, session) => {
        const nextUser = session?.user
        if (nextUser) {
          void loadWorkspaceForUser(nextUser.id, nextUser.email || '')
        } else {
          resetWorkspace(set, 'unauthenticated')
        }
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

    const payload = (await response.json()) as { error?: { message: string } }
    if (!response.ok) {
      const message = payload.error?.message || 'Signup failed.'
      set({ authStatus: 'error', authMessage: message })
      throw new Error(message)
    }

    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (error) {
      set({ authStatus: 'error', authMessage: error.message })
      throw error
    }
    if (data.user) await loadWorkspaceForUser(data.user.id, data.user.email || email)
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

async function loadWorkspaceForUser(userId: string, email: string) {
  useJobmatchStore.setState({
    authStatus: 'authenticated',
    workspaceStatus: 'loading',
    authMessage: '',
    userId,
    profile: createEmptyProfile({ id: userId, email }),
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
  set({
    ...initialState,
    authStatus,
    workspaceStatus: authStatus === 'unauthenticated' ? 'idle' : 'error',
    authMessage,
  })
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
