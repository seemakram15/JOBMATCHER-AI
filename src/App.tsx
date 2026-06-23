import { useMemo, useRef, useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  DatabaseZap,
  FileText,
  Gauge,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  PanelLeft,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserRound,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { motion } from 'framer-motion'
import { formatDistanceToNowStrict } from 'date-fns'
import { FilterPanel } from './components/FilterPanel'
import { JobCard } from './components/JobCard'
import { JobDetailPanel } from './components/JobDetailPanel'
import { KanbanBoard } from './components/KanbanBoard'
import { filterAndSortJobs, scoreJobs } from './lib/scoring'
import { defaultFilters } from './data/mockData'
import { staticDashboardData, useJobmatchStore } from './store/useJobmatchStore'
import type { ParsedCvPayload, ScoredJob } from './types'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/jobs', label: 'Discovery', icon: Search },
  { to: '/cv', label: 'CV Hub', icon: FileText },
  { to: '/tracker', label: 'Tracker', icon: ClipboardList },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/admin', label: 'Admin', icon: ShieldCheck },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/jobs" element={<JobDiscoveryPage />} />
        <Route path="/cv" element={<CvHubPage />} />
        <Route path="/tracker" element={<TrackerPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </AppShell>
  )
}

function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const profile = useJobmatchStore((state) => state.profile)
  const notifications = useJobmatchStore((state) => state.notifications)
  const unread = notifications.filter((notification) => !notification.isRead).length
  const pageLabel = navItems.find((item) => item.to === location.pathname)?.label ?? 'Dashboard'

  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="hidden border-r border-line bg-panel/80 p-4 backdrop-blur lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-white">
              <Sparkles size={21} />
            </div>
            <div>
              <p className="text-lg font-bold text-ink">Jobmatcher</p>
              <p className="text-xs text-muted">AI-ranked job search</p>
            </div>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition ${
                      isActive ? 'bg-primary/15 text-primary' : 'text-muted hover:bg-bg/70 hover:text-ink'
                    }`
                  }
                >
                  <Icon size={17} />
                  {item.label}
                </NavLink>
              )
            })}
          </nav>

          <div className="mt-8 rounded-md border border-line bg-bg/60 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <DatabaseZap size={16} className="text-primary" />
              Source health
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">
              5 sources seeded. Apify, RSS, and API paths are scaffolded with dummy keys.
            </p>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur md:px-6">
            <div className="flex items-center gap-3">
              <button className="icon-button lg:hidden" aria-label="Open navigation" title="Navigation">
                <Menu size={18} />
              </button>
              <div>
                <p className="text-xs text-muted">Workspace</p>
                <h1 className="text-lg font-semibold text-ink">{pageLabel}</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <NavLink className="icon-button relative" to="/alerts" aria-label={`${unread} unread alerts`} title="Alerts">
                <Bell size={17} />
                {unread ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                    {unread}
                  </span>
                ) : null}
              </NavLink>
              <div className="hidden items-center gap-3 rounded-md border border-line bg-panel px-3 py-2 sm:flex">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-success/15 text-success">
                  <UserRound size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">{profile.name}</p>
                  <p className="text-xs text-muted">{profile.role}</p>
                </div>
              </div>
            </div>
          </header>
          <main id="main-content" className="p-4 md:p-6">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  )
}

function useScoredJobs() {
  const profile = useJobmatchStore((state) => state.profile)
  const activeCv = useJobmatchStore((state) => state.activeCv)
  const jobs = useJobmatchStore((state) => state.jobs)
  const savedJobIds = useJobmatchStore((state) => state.savedJobIds)

  return useMemo(() => scoreJobs(profile, activeCv, jobs, savedJobIds), [profile, activeCv, jobs, savedJobIds])
}

function DashboardPage() {
  const scoredJobs = useScoredJobs()
  const applications = useJobmatchStore((state) => state.applications)
  const activeCv = useJobmatchStore((state) => state.activeCv)
  const profile = useJobmatchStore((state) => state.profile)
  const savedCount = applications.filter((application) => application.status === 'saved').length
  const interviews = applications.filter((application) =>
    ['phone_screen', 'interviewing'].includes(application.status),
  ).length
  const averageScore = Math.round(
    scoredJobs.reduce((total, scoredJob) => total + scoredJob.match.totalScore, 0) / scoredJobs.length,
  )
  const jobsToday = scoredJobs.filter(
    ({ job }) => Date.now() - new Date(job.postedAt).getTime() <= 24 * 36e5,
  ).length
  const funnel = ['saved', 'applied', 'phone_screen', 'interviewing', 'offer'].map((status) => ({
    status: status.replace('_', ' '),
    count: applications.filter((application) => application.status === status).length,
  }))

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<BriefcaseBusiness size={20} />} label="Jobs today" value={jobsToday} />
        <StatCard icon={<ClipboardList size={20} />} label="Applications" value={applications.length} />
        <StatCard icon={<Gauge size={20} />} label="Avg score" value={`${averageScore}/100`} />
        <StatCard icon={<CalendarDays size={20} />} label="Interviews" value={interviews} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <div className="panel p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">Search momentum</h2>
              <p className="text-sm text-muted">Viewed and applied activity over the last two weeks.</p>
            </div>
            <span className="rounded-md border border-success/30 bg-success/10 px-3 py-1 text-sm text-success">
              {savedCount} saved
            </span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={staticDashboardData.activity}>
                <CartesianGrid stroke="#2D2D3A" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#8B93A7" fontSize={12} />
                <YAxis stroke="#8B93A7" fontSize={12} />
                <Tooltip contentStyle={{ background: '#1E1E2E', border: '1px solid #2D2D3A' }} />
                <Line type="monotone" dataKey="jobsViewed" stroke="#4A90D9" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="jobsApplied" stroke="#4CAF70" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="text-lg font-semibold text-ink">Active CV signal</h2>
          <div className="mt-4 rounded-md border border-line bg-bg/60 p-4">
            <p className="text-sm text-muted">{activeCv.label}</p>
            <p className="mt-1 text-2xl font-bold text-ink">{activeCv.skills.length} skills</p>
            <p className="mt-1 text-sm text-muted">{activeCv.totalYearsExperience} years parsed experience</p>
          </div>
          <div className="mt-4 space-y-2">
            {activeCv.skills.slice(0, 6).map((skill) => (
              <div key={skill.skillName} className="flex items-center justify-between rounded-md border border-line bg-bg/50 px-3 py-2">
                <span className="text-sm text-ink">{skill.skillName}</span>
                <span className="font-mono text-xs text-muted">{skill.yearsUsed}y</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-muted">
            Targeting {profile.targetRole} roles from {profile.location}, with remote preference enabled.
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="panel p-5">
          <h2 className="text-lg font-semibold text-ink">Application funnel</h2>
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel}>
                <CartesianGrid stroke="#2D2D3A" strokeDasharray="3 3" />
                <XAxis dataKey="status" stroke="#8B93A7" fontSize={12} />
                <YAxis allowDecimals={false} stroke="#8B93A7" fontSize={12} />
                <Tooltip contentStyle={{ background: '#1E1E2E', border: '1px solid #2D2D3A' }} />
                <Bar dataKey="count" fill="#4A90D9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="text-lg font-semibold text-ink">Skills gap</h2>
          <div className="mt-4 space-y-4">
            {staticDashboardData.skillDemand.map((skill) => (
              <div key={skill.skill}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className={skill.userHas ? 'text-ink' : 'text-warning'}>{skill.skill}</span>
                  <span className="font-mono text-muted">{skill.marketDemandPct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-line">
                  <div
                    className={`h-full rounded-full ${skill.userHas ? 'bg-success' : 'bg-warning'}`}
                    style={{ width: `${skill.marketDemandPct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function JobDiscoveryPage() {
  const scoredJobs = useScoredJobs()
  const filters = useJobmatchStore((state) => state.filters)
  const selectedJobId = useJobmatchStore((state) => state.selectedJobId)
  const setFilters = useJobmatchStore((state) => state.setFilters)
  const resetFilters = useJobmatchStore((state) => state.resetFilters)
  const setSelectedJob = useJobmatchStore((state) => state.setSelectedJob)
  const toggleSave = useJobmatchStore((state) => state.toggleSave)
  const applyToJob = useJobmatchStore((state) => state.applyToJob)
  const filteredJobs = useMemo(() => filterAndSortJobs(scoredJobs, filters), [scoredJobs, filters])
  const selected = filteredJobs.find(({ job }) => job.id === selectedJobId) ?? filteredJobs[0] ?? scoredJobs[0]
  const sources = Array.from(new Set(scoredJobs.map(({ job }) => job.sourcePlatform))).sort()

  const handleApply = (scoredJob: ScoredJob) => {
    applyToJob(scoredJob.job.id)
    window.open(scoredJob.job.applyUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_420px]">
      <FilterPanel filters={filters} sources={sources} onChange={setFilters} onReset={resetFilters} />

      <section className="min-w-0">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm text-muted">AI-ranked feed</p>
            <h2 className="text-2xl font-bold text-ink">{filteredJobs.length} matched roles</h2>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-muted transition hover:border-primary hover:text-ink"
              onClick={() => setFilters({ ...defaultFilters, scoreMin: 80 })}
            >
              80%+
            </button>
            <button
              className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-muted transition hover:border-primary hover:text-ink"
              onClick={() => setFilters({ workModes: ['remote'], scoreMin: 70 })}
            >
              Remote
            </button>
          </div>
        </div>
        <div className="space-y-4">
          {filteredJobs.map((scoredJob) => (
            <JobCard
              key={scoredJob.job.id}
              scoredJob={scoredJob}
              isActive={selected?.job.id === scoredJob.job.id}
              onSelect={() => setSelectedJob(scoredJob.job.id)}
              onToggleSave={() => toggleSave(scoredJob.job.id)}
            />
          ))}
        </div>
      </section>

      {selected ? (
        <JobDetailPanel
          scoredJob={selected}
          onApply={() => handleApply(selected)}
          onToggleSave={() => toggleSave(selected.job.id)}
        />
      ) : null}
    </div>
  )
}

function CvHubPage() {
  const profile = useJobmatchStore((state) => state.profile)
  const cvs = useJobmatchStore((state) => state.cvs)
  const activeCv = useJobmatchStore((state) => state.activeCv)
  const activateCv = useJobmatchStore((state) => state.activateCv)
  const addParsedCv = useJobmatchStore((state) => state.addParsedCv)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [parseStatus, setParseStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [parseMessage, setParseMessage] = useState('')
  const [lastParsedCv, setLastParsedCv] = useState<ParsedCvPayload | null>(null)

  const handleCvUpload = async (file: File) => {
    setParseStatus('uploading')
    setParseMessage('Extracting text and parsing CV locally...')

    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/parse-cv', {
        method: 'POST',
        body: formData,
      })
      const payload = (await response.json()) as { cv?: ParsedCvPayload; error?: { message: string } }

      if (!response.ok || !payload.cv) {
        throw new Error(payload.error?.message || 'CV parsing failed.')
      }

      addParsedCv(payload.cv)
      setLastParsedCv(payload.cv)
      setParseStatus('done')
      setParseMessage(
        `Parsed ${payload.cv.skills.length} skills and ${payload.cv.totalYearsExperience} years of experience.`,
      )
    } catch (error) {
      setParseStatus('error')
      setParseMessage(error instanceof Error ? error.message : 'CV parsing failed.')
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="panel p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/15 text-primary">
              <UploadCloud size={22} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-ink">Onboarding pipeline</h2>
              <p className="text-sm text-muted">Profile, CV parsing, and matching preferences are wired for the real APIs.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <StepPanel
              step="01"
              title="Profile"
              text={`${profile.name}, ${profile.location}. Target role: ${profile.targetRole}.`}
              icon={<UserRound size={18} />}
            />
            <StepPanel
              step="02"
              title="Upload CV"
              text={`${activeCv.filename} parsed with ${activeCv.skills.length} skills and ${activeCv.totalYearsExperience} years experience.`}
              icon={<FileText size={18} />}
            />
            <StepPanel
              step="03"
              title="Preferences"
              text={`Remote ${profile.preferredRemote ? 'enabled' : 'disabled'}, salary ${formatCurrency(profile.salaryMin)}-${formatCurrency(profile.salaryMax)}.`}
              icon={<CheckCircle2 size={18} />}
            />
          </div>
          <div className="mt-6 flex min-h-[180px] items-center justify-center rounded-md border border-dashed border-line bg-bg/50 p-6 text-center">
            <div>
              <UploadCloud className="mx-auto text-primary" size={32} />
              <p className="mt-3 text-sm font-semibold text-ink">Drop a PDF or DOCX CV</p>
              <p className="mt-1 text-xs text-muted">PDF, DOCX, DOC, and TXT are parsed without Anthropic or any AI API.</p>
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void handleCvUpload(file)
                  event.target.value = ''
                }}
              />
              <button
                className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={parseStatus === 'uploading'}
                onClick={() => fileInputRef.current?.click()}
              >
                {parseStatus === 'uploading' ? 'Parsing...' : 'Browse file'}
              </button>
              {parseMessage ? (
                <p
                  className={`mt-3 text-xs ${
                    parseStatus === 'error' ? 'text-danger' : parseStatus === 'done' ? 'text-success' : 'text-muted'
                  }`}
                >
                  {parseMessage}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="text-lg font-semibold text-ink">CV versions</h2>
          <div className="mt-4 space-y-3">
            {cvs.map((cv) => (
              <button
                key={cv.id}
                className={`w-full border p-4 text-left transition ${
                  cv.isActive ? 'border-primary bg-primary/10' : 'border-line bg-bg/60 hover:border-primary'
                }`}
                onClick={() => activateCv(cv.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{cv.label}</p>
                    <p className="mt-1 text-xs text-muted">
                      v{cv.version} · {cv.parseStatus} · {cv.skills.length} skills
                    </p>
                  </div>
                  {cv.isActive ? <span className="rounded-md bg-success/15 px-2 py-1 text-xs text-success">Active</span> : null}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="text-lg font-semibold text-ink">Extracted skills</h2>
        {lastParsedCv?.warnings.length ? (
          <div className="mt-4 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
            {lastParsedCv.warnings.join(' ')}
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {activeCv.skills.map((skill) => (
            <div key={skill.skillName} className="rounded-md border border-line bg-bg/60 p-4">
              <p className="font-semibold text-ink">{skill.skillName}</p>
              <p className="mt-1 text-xs text-muted">
                {skill.skillType} · {skill.yearsUsed} years · {skill.confidence}
              </p>
            </div>
          ))}
        </div>
      </section>

      {lastParsedCv ? (
        <section className="grid gap-6 xl:grid-cols-2">
          <div className="panel p-5">
            <h2 className="text-lg font-semibold text-ink">Parsed experience</h2>
            <div className="mt-4 space-y-3">
              {lastParsedCv.experience.length ? (
                lastParsedCv.experience.map((item) => (
                  <div key={`${item.title}-${item.company}-${item.startDate}`} className="rounded-md border border-line bg-bg/60 p-4">
                    <p className="font-semibold text-ink">{item.title}</p>
                    <p className="mt-1 text-sm text-muted">
                      {item.company} · {item.startDate} to {item.endDate ?? 'Present'} · {Math.round(item.totalMonths / 12)}y
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">No dated experience blocks were detected.</p>
              )}
            </div>
          </div>
          <div className="panel p-5">
            <h2 className="text-lg font-semibold text-ink">Education and certificates</h2>
            <div className="mt-4 space-y-3">
              {[...lastParsedCv.education, ...lastParsedCv.certifications].length ? (
                [...lastParsedCv.education, ...lastParsedCv.certifications].map((item) => (
                  <p key={item} className="rounded-md border border-line bg-bg/60 p-3 text-sm text-muted">
                    {item}
                  </p>
                ))
              ) : (
                <p className="text-sm text-muted">No education or certification lines were detected.</p>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}

function TrackerPage() {
  const scoredJobs = useScoredJobs()
  const applications = useJobmatchStore((state) => state.applications)
  const updateApplicationStatus = useJobmatchStore((state) => state.updateApplicationStatus)

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-muted">Application history</p>
          <h2 className="text-2xl font-bold text-ink">Kanban tracker</h2>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm font-semibold text-ink transition hover:border-primary"
          onClick={() => downloadApplications(applications, scoredJobs)}
        >
          <ClipboardList size={16} />
          Export CSV
        </button>
      </div>
      <KanbanBoard
        applications={applications}
        scoredJobs={scoredJobs}
        onMove={(applicationId, status) => updateApplicationStatus(applicationId, status)}
      />
    </div>
  )
}

function AlertsPage() {
  const notifications = useJobmatchStore((state) => state.notifications)
  const markAllNotificationsRead = useJobmatchStore((state) => state.markAllNotificationsRead)

  return (
    <section className="panel p-5">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm text-muted">Notifications</p>
          <h2 className="text-2xl font-bold text-ink">Alerts and reminders</h2>
        </div>
        <button
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white"
          onClick={markAllNotificationsRead}
        >
          Mark all read
        </button>
      </div>
      <div className="space-y-3">
        {notifications.map((notification) => (
          <article
            key={notification.id}
            className={`border p-4 ${notification.isRead ? 'border-line bg-bg/50' : 'border-primary/50 bg-primary/10'}`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-md bg-panel text-primary">
                <Bell size={17} />
              </div>
              <div>
                <h3 className="font-semibold text-ink">{notification.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted">{notification.message}</p>
                <p className="mt-2 text-xs text-muted">
                  {formatDistanceToNowStrict(new Date(notification.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function AdminPage() {
  const sourceTotals = staticDashboardData.sources.reduce(
    (totals, source) => ({
      fetched: totals.fetched + source.jobsFetched,
      fresh: totals.fresh + source.jobsNew,
      failures: totals.failures + source.consecutiveFailures,
    }),
    { fetched: 0, fresh: 0, failures: 0 },
  )

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard icon={<DatabaseZap size={20} />} label="Fetched last run" value={sourceTotals.fetched} />
        <StatCard icon={<Sparkles size={20} />} label="New jobs" value={sourceTotals.fresh} />
        <StatCard icon={<ShieldCheck size={20} />} label="Source failures" value={sourceTotals.failures} />
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-line p-5">
          <h2 className="text-lg font-semibold text-ink">Job sources</h2>
          <p className="text-sm text-muted">Apify actors, direct APIs, RSS feeds, and SerpAPI are represented here.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-bg/70 text-xs uppercase text-muted">
              <tr>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Method</th>
                <th className="px-5 py-3">Schedule</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Fetched</th>
                <th className="px-5 py-3">New</th>
              </tr>
            </thead>
            <tbody>
              {staticDashboardData.sources.map((source) => (
                <tr key={source.id} className="border-t border-line">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-ink">{source.name}</p>
                    <p className="text-xs text-muted">{source.url}</p>
                  </td>
                  <td className="px-5 py-4 text-muted">{source.method}</td>
                  <td className="px-5 py-4 font-mono text-xs text-muted">{source.cronExpression}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-md px-2 py-1 text-xs ${
                        source.lastRunStatus === 'success'
                          ? 'bg-success/15 text-success'
                          : source.lastRunStatus === 'running'
                            ? 'bg-warning/15 text-warning'
                            : 'bg-danger/15 text-danger'
                      }`}
                    >
                      {source.lastRunStatus}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-mono text-muted">{source.jobsFetched}</td>
                  <td className="px-5 py-4 font-mono text-muted">{source.jobsNew}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <HealthTile label="Database" value="Healthy" icon={<DatabaseZap size={18} />} />
        <HealthTile label="Storage" value="4.2GB / 100GB" icon={<FileText size={18} />} />
        <HealthTile label="Claude quota" value="34%" icon={<Sparkles size={18} />} />
        <HealthTile label="Apify runs" value="2,840 today" icon={<PanelLeft size={18} />} />
      </section>
    </div>
  )
}

function SettingsPage() {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
      <section className="panel p-5">
        <h2 className="text-lg font-semibold text-ink">Environment readiness</h2>
        <div className="mt-4 space-y-3">
          {[
            ['Supabase', 'SUPABASE_URL, SUPABASE_ANON_KEY, service-role key'],
            ['CV parser', 'PDF/DOCX/TXT parsing runs locally through /api/parse-cv'],
            ['Apify', 'APIFY_API_TOKEN plus webhook secret'],
            ['Email', 'RESEND_API_KEY for alerts and digests'],
            ['Redis', 'Upstash REST credentials for rate limits'],
          ].map(([label, detail]) => (
            <div key={label} className="rounded-md border border-line bg-bg/60 p-4">
              <p className="font-semibold text-ink">{label}</p>
              <p className="mt-1 text-sm text-muted">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="text-lg font-semibold text-ink">Security controls</h2>
        <div className="mt-4 space-y-3">
          <SecurityRow icon={<LockKeyhole size={17} />} title="JWT + RLS" text="User-facing data maps to Supabase row-level policies." />
          <SecurityRow icon={<ShieldCheck size={17} />} title="DOMPurify" text="Job HTML is sanitized before rendering." />
          <SecurityRow icon={<LogOut size={17} />} title="GDPR flows" text="Export and account deletion endpoints are represented in docs and schema." />
        </div>
      </section>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="panel p-5">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">{icon}</div>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold text-ink">{value}</p>
    </div>
  )
}

function StepPanel({ step, title, text, icon }: { step: string; title: string; text: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-bg/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-xs text-primary">{step}</span>
        <span className="text-primary">{icon}</span>
      </div>
      <p className="font-semibold text-ink">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
    </div>
  )
}

function HealthTile({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-panel/80 p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-success/15 text-success">{icon}</div>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-semibold text-ink">{value}</p>
    </div>
  )
}

function SecurityRow({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-md border border-line bg-bg/60 p-4">
      <div className="mt-1 text-primary">{icon}</div>
      <div>
        <p className="font-semibold text-ink">{title}</p>
        <p className="mt-1 text-sm leading-6 text-muted">{text}</p>
      </div>
    </div>
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 0,
  }).format(value)
}

function downloadApplications(applications: ReturnType<typeof useJobmatchStore.getState>['applications'], scoredJobs: ScoredJob[]) {
  const rows = [
    ['company', 'title', 'status', 'applied_at', 'match_score', 'notes'],
    ...applications.map((application) => {
      const scoredJob = scoredJobs.find(({ job }) => job.id === application.jobId)
      return [
        scoredJob?.job.company ?? '',
        scoredJob?.job.title ?? '',
        application.status,
        application.appliedAt ?? '',
        scoredJob?.match.totalScore ?? '',
        application.notes.replace(/\n/g, ' '),
      ]
    }),
  ]
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `jobmatcher-applications-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default App
