import { create } from 'zustand'
import {
  defaultFilters,
  mockActivity,
  mockApplications,
  mockCvs,
  mockJobs,
  mockNotifications,
  mockProfile,
  mockSkillDemand,
  mockSources,
} from '../data/mockData'
import { scoreJobs } from '../lib/scoring'
import type {
  Application,
  ApplicationStatus,
  CvProfile,
  Job,
  JobFilters,
  NotificationItem,
  UserProfile,
} from '../types'

interface JobmatchState {
  profile: UserProfile
  cvs: CvProfile[]
  jobs: Job[]
  applications: Application[]
  notifications: NotificationItem[]
  filters: JobFilters
  selectedJobId: string
  activeCv: CvProfile
  savedJobIds: string[]
  setSelectedJob: (jobId: string) => void
  setFilters: (filters: Partial<JobFilters>) => void
  resetFilters: () => void
  toggleSave: (jobId: string) => void
  applyToJob: (jobId: string, notes?: string) => void
  updateApplicationStatus: (applicationId: string, status: ApplicationStatus) => void
  markAllNotificationsRead: () => void
  activateCv: (cvId: string) => void
}

const createId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`
const timestamp = () => new Date().toISOString()

const initialSavedJobIds = mockApplications
  .filter((application) => application.status === 'saved')
  .map((application) => application.jobId)

const getActiveCv = (cvs: CvProfile[], profile: UserProfile) =>
  cvs.find((cv) => cv.id === profile.activeCvId) ?? cvs[0]

export const useJobmatchStore = create<JobmatchState>((set) => ({
  profile: mockProfile,
  cvs: mockCvs,
  jobs: mockJobs,
  applications: mockApplications,
  notifications: mockNotifications,
  filters: defaultFilters,
  selectedJobId: 'job_001',
  activeCv: getActiveCv(mockCvs, mockProfile),
  savedJobIds: initialSavedJobIds,
  setSelectedJob: (jobId) => set({ selectedJobId: jobId }),
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  resetFilters: () => set({ filters: defaultFilters }),
  toggleSave: (jobId) =>
    set((state) => {
      const existing = state.applications.find((application) => application.jobId === jobId)
      const isSaved = state.savedJobIds.includes(jobId)

      if (isSaved) {
        return {
          savedJobIds: state.savedJobIds.filter((id) => id !== jobId),
          applications: state.applications.filter(
            (application) => application.jobId !== jobId || application.status !== 'saved',
          ),
        }
      }

      if (existing) {
        return {
          savedJobIds: [...state.savedJobIds, jobId],
          applications: state.applications.map((application) =>
            application.id === existing.id ? { ...application, status: 'saved', lastUpdated: timestamp() } : application,
          ),
        }
      }

      return {
        savedJobIds: [...state.savedJobIds, jobId],
        applications: [
          ...state.applications,
          {
            id: createId('app'),
            jobId,
            cvId: state.activeCv.id,
            status: 'saved',
            notes: 'Saved from discovery.',
            createdAt: timestamp(),
            lastUpdated: timestamp(),
            history: [{ oldStatus: null, newStatus: 'saved', note: 'Saved from discovery', changedAt: timestamp() }],
          },
        ],
      }
    }),
  applyToJob: (jobId, notes = 'Applied from Jobmatcher discovery flow.') =>
    set((state) => {
      const existing = state.applications.find((application) => application.jobId === jobId)
      if (existing) {
        return {
          applications: state.applications.map((application) =>
            application.id === existing.id
              ? {
                  ...application,
                  status: 'applied',
                  notes: notes || application.notes,
                  appliedAt: application.appliedAt ?? timestamp(),
                  lastUpdated: timestamp(),
                  history: [
                    ...application.history,
                    {
                      oldStatus: application.status,
                      newStatus: 'applied',
                      note: 'Application recorded',
                      changedAt: timestamp(),
                    },
                  ],
                }
              : application,
          ),
          savedJobIds: state.savedJobIds.filter((id) => id !== jobId),
        }
      }

      return {
        applications: [
          ...state.applications,
          {
            id: createId('app'),
            jobId,
            cvId: state.activeCv.id,
            status: 'applied',
            notes,
            appliedAt: timestamp(),
            createdAt: timestamp(),
            lastUpdated: timestamp(),
            history: [{ oldStatus: null, newStatus: 'applied', note: 'Application recorded', changedAt: timestamp() }],
          },
        ],
        savedJobIds: state.savedJobIds.filter((id) => id !== jobId),
      }
    }),
  updateApplicationStatus: (applicationId, status) =>
    set((state) => ({
      applications: state.applications.map((application) =>
        application.id === applicationId
          ? {
              ...application,
              status,
              appliedAt: status === 'applied' && !application.appliedAt ? timestamp() : application.appliedAt,
              lastUpdated: timestamp(),
              history: [
                ...application.history,
                {
                  oldStatus: application.status,
                  newStatus: status,
                  note: 'Status moved on tracker',
                  changedAt: timestamp(),
                },
              ],
            }
          : application,
      ),
    })),
  markAllNotificationsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((notification) => ({ ...notification, isRead: true })),
    })),
  activateCv: (cvId) =>
    set((state) => {
      const profile = { ...state.profile, activeCvId: cvId }
      const cvs = state.cvs.map((cv) => ({ ...cv, isActive: cv.id === cvId }))
      return {
        profile,
        cvs,
        activeCv: getActiveCv(cvs, profile),
      }
    }),
}))

export const selectScoredJobs = () => {
  const state = useJobmatchStore.getState()
  return scoreJobs(state.profile, state.activeCv, state.jobs, state.savedJobIds)
}

export const staticDashboardData = {
  activity: mockActivity,
  skillDemand: mockSkillDemand,
  sources: mockSources,
}
