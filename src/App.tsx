import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  DatabaseZap,
  FileText,
  FileUp,
  Globe2,
  LayoutDashboard,
  LockKeyhole,
  LogIn,
  LogOut,
  Menu,
  Plus,
  Radio,
  RefreshCw,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  UploadCloud,
  UserPlus,
  UserRound,
  WandSparkles,
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
import { defaultFilters } from './lib/defaults'
import { useJobmatchStore } from './store/useJobmatchStore'
import type { Application, CvExperience, Job, LiveJobSourceResult, ParsedCvPayload, ScoredJob } from './types'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/jobs', label: 'Discovery', icon: Search },
  { to: '/cv', label: 'CV Hub', icon: FileText },
  { to: '/tracker', label: 'Tracker', icon: ClipboardList },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/admin', label: 'Admin', icon: ShieldCheck },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function App() {
  const location = useLocation()
  const authStatus = useJobmatchStore((state) => state.authStatus)
  const workspaceStatus = useJobmatchStore((state) => state.workspaceStatus)
  const authMessage = useJobmatchStore((state) => state.authMessage)
  const initializeAuth = useJobmatchStore((state) => state.initializeAuth)

  useEffect(() => {
    void initializeAuth()
  }, [initializeAuth])

  if (location.pathname === '/') {
    return <LandingPage />
  }

  if (location.pathname === '/auth' || authStatus === 'unauthenticated' || authStatus === 'error') {
    return <AuthPage />
  }

  if (authStatus === 'loading' || workspaceStatus === 'loading') {
    return <LoadingScreen message={authMessage || 'Loading your workspace...'} />
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
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

function LandingPage() {
  const featureCards = [
    {
      icon: <FileUp size={20} />,
      title: 'Upload CV once',
      text: 'PDF, DOCX, DOC, and TXT parsing runs locally and builds your skill profile.',
    },
    {
      icon: <Radio size={20} />,
      title: 'Extract live jobs',
      text: 'Searches real remote job APIs and Google Jobs through your configured sources.',
    },
    {
      icon: <Rocket size={20} />,
      title: 'Rank by fit',
      text: 'Scores jobs against your skills, experience, role target, location, and freshness.',
    },
  ]

  return (
    <main className="min-h-screen bg-bg text-ink">
      <section className="relative min-h-[92vh] overflow-hidden">
        <img
          className="absolute inset-0 h-full w-full object-cover opacity-45"
          src="https://images.unsplash.com/photo-1551836022-deb4988cc6c0?auto=format&fit=crop&w=1800&q=85"
          alt=""
        />
        <div className="absolute inset-0 bg-gradient-to-br from-bg via-bg/82 to-bg/30" />

        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-white shadow-soft">
              <Sparkles size={22} />
            </div>
            <div>
              <p className="text-lg font-bold">Jobmatcher</p>
              <p className="text-xs text-muted">AI-ranked job search</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NavLink
              className="inline-flex h-10 items-center gap-2 rounded-md border border-white/15 bg-white/8 px-4 text-sm font-semibold text-ink backdrop-blur transition hover:border-primary"
              to="/auth?mode=signin"
            >
              <LogIn size={16} /> Sign in
            </NavLink>
            <NavLink
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/90"
              to="/auth?mode=signup"
            >
              <UserPlus size={16} /> Sign up
            </NavLink>
          </div>
        </header>

        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-5 pb-20 pt-16 md:px-8 lg:grid-cols-[1fr_520px] lg:pt-24">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
              <WandSparkles size={16} />
              Local CV parsing + live job extraction
            </div>
            <h1 className="max-w-4xl text-5xl font-extrabold leading-tight text-white md:text-7xl">
              Find the jobs that fit your CV.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Upload your CV, add skills manually, fetch real listings, and track every application without a messy spreadsheet.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <NavLink
                className="inline-flex h-12 items-center gap-2 rounded-md bg-primary px-5 text-sm font-bold text-white shadow-soft transition hover:bg-primary/90"
                to="/auth?mode=signup"
              >
                Upload CV <ArrowRight size={17} />
              </NavLink>
              <NavLink
                className="inline-flex h-12 items-center gap-2 rounded-md border border-white/15 bg-white/8 px-5 text-sm font-bold text-ink backdrop-blur transition hover:border-primary"
                to="/auth?mode=signin"
              >
                Explore jobs <Search size={17} />
              </NavLink>
            </div>
          </div>

          <div className="rounded-md border border-white/12 bg-panel/75 p-4 shadow-soft backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">Live matching preview</p>
                <p className="font-semibold text-ink">Senior Frontend Engineer</p>
              </div>
              <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 font-mono text-xl font-bold text-success">
                92%
              </div>
            </div>
            <div className="space-y-3">
              {[
                ['React Platform Engineer', 'Remote', 'React, TypeScript, APIs'],
                ['Product Frontend Engineer', 'Hybrid', 'Vite, Tailwind, Charts'],
                ['AI Workflow Developer', 'Remote', 'Node.js, PostgreSQL, REST'],
              ].map(([title, location, skills]) => (
                <div key={title} className="rounded-md border border-line bg-bg/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{title}</p>
                      <p className="mt-1 text-xs text-muted">{location}</p>
                    </div>
                    <BriefcaseBusiness className="text-primary" size={20} />
                  </div>
                  <p className="mt-3 text-xs text-muted">{skills}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 py-10 md:grid-cols-3 md:px-8">
        {featureCards.map((feature) => (
          <article key={feature.title} className="rounded-md border border-line bg-panel/80 p-5">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-primary/15 text-primary">
              {feature.icon}
            </div>
            <h2 className="text-lg font-semibold">{feature.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{feature.text}</p>
          </article>
        ))}
      </section>
    </main>
  )
}

function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryMode = new URLSearchParams(location.search).get('mode')
  const authStatus = useJobmatchStore((state) => state.authStatus)
  const workspaceStatus = useJobmatchStore((state) => state.workspaceStatus)
  const authMessage = useJobmatchStore((state) => state.authMessage)
  const signIn = useJobmatchStore((state) => state.signIn)
  const signUp = useJobmatchStore((state) => state.signUp)
  const [mode, setMode] = useState<'signin' | 'signup'>(queryMode === 'signup' ? 'signup' : 'signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formMessage, setFormMessage] = useState('')

  useEffect(() => {
    if (authStatus === 'authenticated' && workspaceStatus === 'ready') navigate('/dashboard')
  }, [authStatus, workspaceStatus, navigate])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormMessage('')

    try {
      if (mode === 'signup') {
        await signUp(email.trim(), password, name.trim())
        setFormMessage('Account created. If email confirmation is enabled, confirm your email and sign in.')
      } else {
        await signIn(email.trim(), password)
      }
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : 'Authentication failed.')
    }
  }

  return (
    <main className="grid min-h-screen bg-bg text-ink lg:grid-cols-[1fr_520px]">
      <section className="relative hidden overflow-hidden lg:block">
        <img
          className="absolute inset-0 h-full w-full object-cover opacity-55"
          src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=85"
          alt=""
        />
        <div className="absolute inset-0 bg-gradient-to-br from-bg via-bg/80 to-bg/20" />
        <div className="relative z-10 flex h-full flex-col justify-between p-10">
          <NavLink className="flex items-center gap-3" to="/">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-white shadow-soft">
              <Sparkles size={22} />
            </div>
            <div>
              <p className="text-lg font-bold">Jobmatcher</p>
              <p className="text-xs text-muted">Private user workspace</p>
            </div>
          </NavLink>
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
              <ShieldCheck size={16} />
              User-owned data through Supabase Auth
            </div>
            <h1 className="max-w-xl text-5xl font-extrabold leading-tight text-white">
              Your CV, jobs, and tracker belong to your account.
            </h1>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <NavLink className="flex items-center gap-3" to="/">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-white shadow-soft">
                <Sparkles size={22} />
              </div>
              <div>
                <p className="text-lg font-bold">Jobmatcher</p>
                <p className="text-xs text-muted">AI-ranked job search</p>
              </div>
            </NavLink>
          </div>

          <div className="panel p-6">
            <div className="mb-6 flex rounded-md border border-line bg-bg/70 p-1">
              {(['signin', 'signup'] as const).map((item) => (
                <button
                  key={item}
                  className={`h-10 flex-1 rounded-md text-sm font-semibold transition ${
                    mode === item ? 'bg-primary text-white' : 'text-muted hover:text-ink'
                  }`}
                  onClick={() => setMode(item)}
                >
                  {item === 'signin' ? 'Sign in' : 'Sign up'}
                </button>
              ))}
            </div>

            <form className="space-y-4" onSubmit={submit}>
              {mode === 'signup' ? (
                <label className="block text-xs font-medium uppercase text-muted">
                  Name
                  <input
                    className="control mt-2 h-11 w-full rounded-md px-3 text-sm normal-case"
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
              ) : null}
              <label className="block text-xs font-medium uppercase text-muted">
                Email
                <input
                  className="control mt-2 h-11 w-full rounded-md px-3 text-sm normal-case"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label className="block text-xs font-medium uppercase text-muted">
                Password
                <input
                  className="control mt-2 h-11 w-full rounded-md px-3 text-sm normal-case"
                  type="password"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  minLength={6}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <button
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={authStatus === 'loading'}
              >
                {mode === 'signup' ? <UserPlus size={16} /> : <LogIn size={16} />}
                {authStatus === 'loading' ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}
              </button>
            </form>

            {[formMessage, authMessage].filter(Boolean).map((message) => (
              <p key={message} className={`mt-4 text-sm ${authStatus === 'error' ? 'text-danger' : 'text-muted'}`}>
                {message}
              </p>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-5 text-ink">
      <div className="panel w-full max-w-sm p-6 text-center">
        <RefreshCw className="mx-auto animate-spin text-primary" size={28} />
        <p className="mt-4 font-semibold">{message}</p>
      </div>
    </main>
  )
}

function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const profile = useJobmatchStore((state) => state.profile)
  const notifications = useJobmatchStore((state) => state.notifications)
  const signOut = useJobmatchStore((state) => state.signOut)
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
              Live extraction reads direct job APIs and server-only search keys from local env.
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
              <button className="icon-button" onClick={() => void signOut()} aria-label="Sign out" title="Sign out">
                <LogOut size={17} />
              </button>
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

function useLiveJobSearch() {
  const navigate = useNavigate()
  const setLiveJobs = useJobmatchStore((state) => state.setLiveJobs)
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const runLiveSearch = async (goToJobs = false) => {
    const { profile, activeCv } = useJobmatchStore.getState()
    const skills = activeCv.skills.map((skill) => skill.skillName).slice(0, 10)
    const query = [profile.targetRole, ...skills.slice(0, 4)].filter(Boolean).join(' ')
    const params = new URLSearchParams({
      query,
      location: profile.preferredRemote ? 'Remote' : profile.location,
      skills: skills.join(','),
      experienceYears: String(activeCv.totalYearsExperience || 0),
      limit: '60',
    })

    setStatus('loading')
    setMessage('Fetching real jobs from live sources...')

    try {
      const response = await fetch(`/api/live-jobs?${params.toString()}`)
      const payload = (await response.json()) as {
        jobs?: Job[]
        sources?: LiveJobSourceResult[]
        error?: { message: string }
      }

      if (!response.ok || !payload.jobs) {
        throw new Error(payload.error?.message || 'Live job extraction failed.')
      }

      setLiveJobs(payload.jobs, payload.sources || [])
      setStatus('done')
      setMessage(`Fetched ${payload.jobs.length} real jobs from live sources.`)
      if (goToJobs) navigate('/jobs')
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Live job extraction failed.')
    }
  }

  return { status, message, runLiveSearch }
}

function DashboardPage() {
  const scoredJobs = useScoredJobs()
  const applications = useJobmatchStore((state) => state.applications)
  const activeCv = useJobmatchStore((state) => state.activeCv)
  const profile = useJobmatchStore((state) => state.profile)
  const searchedJobsCount = useJobmatchStore((state) => state.searchedJobsCount)
  const lastLiveSearchAt = useJobmatchStore((state) => state.lastLiveSearchAt)
  const savedCount = applications.filter((application) => application.status === 'saved').length
  const interviews = applications.filter((application) => application.status === 'interviewing').length
  const averageScore = scoredJobs.length
    ? Math.round(scoredJobs.reduce((total, scoredJob) => total + scoredJob.match.totalScore, 0) / scoredJobs.length)
    : 0
  const jobsToday = scoredJobs.filter(
    ({ job }) => Date.now() - new Date(job.postedAt).getTime() <= 24 * 36e5,
  ).length
  const activity = useMemo(
    () => buildActivity(applications, searchedJobsCount, lastLiveSearchAt),
    [applications, searchedJobsCount, lastLiveSearchAt],
  )
  const skillDemand = useMemo(() => buildSkillDemand(scoredJobs, activeCv.skills.map((skill) => skill.skillCanonical)), [
    scoredJobs,
    activeCv.skills,
  ])
  const funnel = ['saved', 'applied', 'interviewing', 'offer'].map((status) => ({
    status: status.replace('_', ' '),
    count: applications.filter((application) => application.status === status).length,
  }))

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard icon={<Search size={20} />} label="Searched jobs" value={searchedJobsCount} />
        <StatCard
          icon={<ClipboardList size={20} />}
          label="Applied jobs"
          value={applications.filter((application) => application.status === 'applied').length}
        />
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
              {savedCount} saved · {jobsToday} new today · avg {averageScore}/100
            </span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activity}>
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
            Targeting {profile.targetRole} roles from {profile.location}, with remote preference{' '}
            {profile.preferredRemote ? 'enabled' : 'disabled'}.
            {lastLiveSearchAt ? ` Last live search: ${formatDistanceToNowStrict(new Date(lastLiveSearchAt), { addSuffix: true })}.` : ''}
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
            {skillDemand.length ? (
              skillDemand.map((skill) => (
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
              ))
            ) : (
              <p className="text-sm leading-6 text-muted">
                Run live extraction after uploading a CV to see market demand against your own skills.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function buildActivity(applications: Application[], searchedJobsCount: number, lastLiveSearchAt: string | null) {
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (13 - index))
    const key = date.toISOString().slice(0, 10)
    return { date: key.slice(5), key, jobsViewed: 0, jobsApplied: 0 }
  })

  if (lastLiveSearchAt) {
    const searchKey = new Date(lastLiveSearchAt).toISOString().slice(0, 10)
    const bucket = days.find((day) => day.key === searchKey)
    if (bucket) bucket.jobsViewed = searchedJobsCount
  }

  for (const application of applications) {
    const createdKey = new Date(application.createdAt).toISOString().slice(0, 10)
    const createdBucket = days.find((day) => day.key === createdKey)
    if (createdBucket) createdBucket.jobsViewed += 1

    if (application.appliedAt) {
      const appliedKey = new Date(application.appliedAt).toISOString().slice(0, 10)
      const appliedBucket = days.find((day) => day.key === appliedKey)
      if (appliedBucket) appliedBucket.jobsApplied += 1
    }
  }

  return days
}

function buildSkillDemand(scoredJobs: ScoredJob[], userSkills: string[]) {
  const userSkillSet = new Set(userSkills.map((skill) => skill.toLowerCase()))
  const counts = new Map<string, number>()

  for (const { job } of scoredJobs) {
    for (const skill of job.skillsRequired) {
      counts.set(skill.skill, (counts.get(skill.skill) || 0) + 1)
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([skill, count]) => ({
      skill,
      userHas: userSkillSet.has(skill.toLowerCase()),
      marketDemandPct: Math.max(10, Math.round((count / Math.max(scoredJobs.length, 1)) * 100)),
    }))
}

function JobDiscoveryPage() {
  const scoredJobs = useScoredJobs()
  const activeCv = useJobmatchStore((state) => state.activeCv)
  const filters = useJobmatchStore((state) => state.filters)
  const selectedJobId = useJobmatchStore((state) => state.selectedJobId)
  const liveJobSources = useJobmatchStore((state) => state.liveJobSources)
  const lastLiveSearchAt = useJobmatchStore((state) => state.lastLiveSearchAt)
  const setFilters = useJobmatchStore((state) => state.setFilters)
  const resetFilters = useJobmatchStore((state) => state.resetFilters)
  const setSelectedJob = useJobmatchStore((state) => state.setSelectedJob)
  const toggleSave = useJobmatchStore((state) => state.toggleSave)
  const applyToJob = useJobmatchStore((state) => state.applyToJob)
  const liveSearch = useLiveJobSearch()
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
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={liveSearch.status === 'loading'}
              onClick={() => void liveSearch.runLiveSearch(false)}
            >
              <RefreshCw size={16} className={liveSearch.status === 'loading' ? 'animate-spin' : ''} />
              {liveSearch.status === 'loading' ? 'Extracting...' : 'Run live extraction'}
            </button>
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

        <div className="mb-4 rounded-md border border-line bg-panel/80 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary">
                <Globe2 size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Live source status</p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Using {activeCv.skills.slice(0, 5).map((skill) => skill.skillName).join(', ') || 'your profile'}.
                  {lastLiveSearchAt
                    ? ` Last extracted ${formatDistanceToNowStrict(new Date(lastLiveSearchAt), { addSuffix: true })}.`
                    : ' Run extraction to load real listings into your workspace.'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(liveJobSources.length ? liveJobSources : [{ name: 'Ready', count: scoredJobs.length, ok: true }]).map((source) => (
                <span
                  key={source.name}
                  className={`rounded-md border px-2 py-1 text-xs ${
                    source.ok ? 'border-success/30 bg-success/10 text-success' : 'border-danger/30 bg-danger/10 text-danger'
                  }`}
                  title={source.error}
                >
                  {source.name}: {source.count}
                </span>
              ))}
            </div>
          </div>
          {liveSearch.message ? (
            <p className={`mt-3 text-xs ${liveSearch.status === 'error' ? 'text-danger' : 'text-muted'}`}>
              {liveSearch.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-4">
          {filteredJobs.length ? (
            filteredJobs.map((scoredJob) => (
              <JobCard
                key={scoredJob.job.id}
                scoredJob={scoredJob}
                isActive={selected?.job.id === scoredJob.job.id}
                onSelect={() => setSelectedJob(scoredJob.job.id)}
                onToggleSave={() => toggleSave(scoredJob.job.id)}
              />
            ))
          ) : (
            <div className="rounded-md border border-line bg-panel/80 p-8 text-center">
              <Search className="mx-auto text-primary" size={28} />
              <p className="mt-3 font-semibold text-ink">No matching jobs in the current filters</p>
              <p className="mt-1 text-sm text-muted">Run live extraction or reset filters to refresh the feed.</p>
            </div>
          )}
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
  const addManualSkills = useJobmatchStore((state) => state.addManualSkills)
  const setActiveExperience = useJobmatchStore((state) => state.setActiveExperience)
  const replaceActiveExperience = useJobmatchStore((state) => state.replaceActiveExperience)
  const updateProfile = useJobmatchStore((state) => state.updateProfile)
  const liveSearch = useLiveJobSearch()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [parseStatus, setParseStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [parseMessage, setParseMessage] = useState('')
  const [lastParsedCv, setLastParsedCv] = useState<ParsedCvPayload | null>(null)
  const [targetRole, setTargetRole] = useState(profile.targetRole)
  const [location, setLocation] = useState(profile.location)
  const [preferredRemote, setPreferredRemote] = useState(profile.preferredRemote)
  const [manualSkills, setManualSkills] = useState('')
  const [manualYears, setManualYears] = useState(String(activeCv.totalYearsExperience || 1))
  const [profileMessage, setProfileMessage] = useState('')
  const [experienceDrafts, setExperienceDrafts] = useState<CvExperience[]>(activeCv.experience)

  useEffect(() => {
    setTargetRole(profile.targetRole)
    setLocation(profile.location)
    setPreferredRemote(profile.preferredRemote)
  }, [profile.targetRole, profile.location, profile.preferredRemote])

  useEffect(() => {
    setManualYears(String(activeCv.totalYearsExperience || 0))
    setExperienceDrafts(activeCv.experience)
  }, [activeCv.id, activeCv.totalYearsExperience, activeCv.experience])

  const saveProfileSignal = () => {
    const years = Math.max(0, Number(manualYears) || 0)
    updateProfile({
      targetRole: targetRole.trim() || profile.targetRole,
      location: location.trim() || profile.location,
      preferredRemote,
    })
    setActiveExperience(years)

    const skills = manualSkills
      .split(',')
      .map((skill) => skill.trim())
      .filter(Boolean)

    if (skills.length) {
      addManualSkills(skills, years)
      setManualSkills('')
    }

    setProfileMessage(
      skills.length
        ? `Added ${skills.length} manual skill${skills.length === 1 ? '' : 's'} and saved ${years} years experience.`
        : `Saved profile signal with ${years} years experience.`,
    )
  }

  const searchFromCv = () => {
    saveProfileSignal()
    void liveSearch.runLiveSearch(true)
  }

  const saveExperienceDrafts = () => {
    const cleaned = experienceDrafts
      .map((item) => ({
        ...item,
        title: item.title.trim() || 'Role',
        company: item.company.trim() || 'Company',
        totalMonths: calculateExperienceMonths(item),
      }))
      .filter((item) => item.startDate)
    const totalYears = Number((cleaned.reduce((total, item) => total + item.totalMonths, 0) / 12).toFixed(1))
    replaceActiveExperience(cleaned, totalYears)
    setManualYears(String(totalYears))
    setProfileMessage(`Saved ${cleaned.length} experience row${cleaned.length === 1 ? '' : 's'} and updated total experience to ${totalYears} years.`)
  }

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
      setManualYears(String(payload.cv.totalYearsExperience || Number(manualYears) || 1))
      void liveSearch.runLiveSearch(false)
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

        <div className="space-y-6">
          <div className="panel p-5">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-success/15 text-success">
                <Target size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ink">Candidate signal</h2>
                <p className="text-sm text-muted">Tune the skills and experience used for live extraction.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium uppercase text-muted">
                Target role
                <input
                  className="control mt-2 h-11 w-full rounded-md px-3 text-sm normal-case"
                  value={targetRole}
                  onChange={(event) => setTargetRole(event.target.value)}
                />
              </label>
              <label className="text-xs font-medium uppercase text-muted">
                Location
                <input
                  className="control mt-2 h-11 w-full rounded-md px-3 text-sm normal-case"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                />
              </label>
              <label className="text-xs font-medium uppercase text-muted">
                Experience
                <select
                  className="control mt-2 h-11 w-full rounded-md px-3 text-sm normal-case"
                  value={manualYears}
                  onChange={(event) => setManualYears(event.target.value)}
                >
                  {[0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15].map((years) => (
                    <option key={years} value={years}>
                      {years} {years === 1 ? 'year' : 'years'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-h-11 items-center gap-3 rounded-md border border-line bg-bg/60 px-3 text-sm text-ink sm:mt-6">
                <input
                  type="checkbox"
                  checked={preferredRemote}
                  onChange={(event) => setPreferredRemote(event.target.checked)}
                />
                Remote preferred
              </label>
            </div>
            <label className="mt-4 block text-xs font-medium uppercase text-muted">
              Manual skills
              <textarea
                className="control mt-2 min-h-24 w-full rounded-md px-3 py-3 text-sm normal-case"
                placeholder="React, TypeScript, Node.js, PostgreSQL"
                value={manualSkills}
                onChange={(event) => setManualSkills(event.target.value)}
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="inline-flex items-center gap-2 rounded-md border border-line bg-bg px-4 py-2 text-sm font-semibold text-ink transition hover:border-primary"
                onClick={saveProfileSignal}
              >
                <Plus size={16} />
                Save signal
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={liveSearch.status === 'loading'}
                onClick={searchFromCv}
              >
                <Rocket size={16} />
                {liveSearch.status === 'loading' ? 'Searching...' : 'Search live jobs'}
              </button>
            </div>
            {[profileMessage, liveSearch.message].filter(Boolean).map((message) => (
              <p
                key={message}
                className={`mt-3 text-xs ${liveSearch.status === 'error' && message === liveSearch.message ? 'text-danger' : 'text-muted'}`}
              >
                {message}
              </p>
            ))}
          </div>

          <div className="panel p-5">
            <h2 className="text-lg font-semibold text-ink">CV versions</h2>
            <div className="mt-4 space-y-3">
              {cvs.length ? (
                cvs.map((cv) => (
                  <button
                    key={cv.id}
                    className={`w-full rounded-md border p-4 text-left transition ${
                      cv.isActive ? 'border-primary bg-primary/10' : 'border-line bg-bg/60 hover:border-primary'
                    }`}
                    onClick={() => {
                      activateCv(cv.id)
                      setManualYears(String(cv.totalYearsExperience || 1))
                    }}
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
                ))
              ) : (
                <p className="rounded-md border border-line bg-bg/60 p-4 text-sm text-muted">
                  No CV uploaded yet. Upload a CV or save manual skills to create your first profile signal.
                </p>
              )}
            </div>
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
          {activeCv.skills.length ? (
            activeCv.skills.map((skill) => (
              <div key={skill.skillName} className="rounded-md border border-line bg-bg/60 p-4">
                <p className="font-semibold text-ink">{skill.skillName}</p>
                <p className="mt-1 text-xs text-muted">
                  {skill.skillType} · {skill.yearsUsed} years · {skill.confidence}
                </p>
              </div>
            ))
          ) : (
            <p className="rounded-md border border-line bg-bg/60 p-4 text-sm text-muted sm:col-span-2 xl:col-span-4">
              No skills yet. Upload a CV or add comma-separated skills in Candidate signal.
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ExperienceEditor
          drafts={experienceDrafts}
          onChange={setExperienceDrafts}
          onSave={saveExperienceDrafts}
        />
        {lastParsedCv ? (
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
        ) : (
          <div className="panel p-5">
            <h2 className="text-lg font-semibold text-ink">Education and certificates</h2>
            <p className="mt-4 text-sm leading-6 text-muted">
              Upload a CV to extract education and certificates for this user account.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

function ExperienceEditor({
  drafts,
  onChange,
  onSave,
}: {
  drafts: CvExperience[]
  onChange: (drafts: CvExperience[]) => void
  onSave: () => void
}) {
  const updateDraft = (index: number, patch: Partial<CvExperience>) => {
    onChange(drafts.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))
  }

  const addDraft = () => {
    onChange([
      ...drafts,
      {
        title: '',
        company: '',
        startDate: '',
        endDate: null,
        isCurrent: false,
        totalMonths: 0,
      },
    ])
  }

  const removeDraft = (index: number) => {
    onChange(drafts.filter((_item, itemIndex) => itemIndex !== index))
  }

  return (
    <div className="panel p-5">
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-semibold text-ink">Editable experience</h2>
          <p className="text-sm text-muted">Correct the rows extracted from your CV before matching jobs.</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-md border border-line bg-bg px-3 py-2 text-sm font-semibold text-ink transition hover:border-primary"
          onClick={addDraft}
        >
          <Plus size={16} />
          Add row
        </button>
      </div>

      <div className="space-y-3">
        {drafts.length ? (
          drafts.map((item, index) => (
            <div key={`${item.title}-${item.company}-${index}`} className="rounded-md border border-line bg-bg/60 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs font-medium uppercase text-muted">
                  Title
                  <input
                    className="control mt-2 h-10 w-full rounded-md px-3 text-sm normal-case"
                    value={item.title}
                    onChange={(event) => updateDraft(index, { title: event.target.value })}
                  />
                </label>
                <label className="text-xs font-medium uppercase text-muted">
                  Company
                  <input
                    className="control mt-2 h-10 w-full rounded-md px-3 text-sm normal-case"
                    value={item.company}
                    onChange={(event) => updateDraft(index, { company: event.target.value })}
                  />
                </label>
                <label className="text-xs font-medium uppercase text-muted">
                  Start
                  <input
                    className="control mt-2 h-10 w-full rounded-md px-3 text-sm normal-case"
                    type="month"
                    value={toMonthValue(item.startDate)}
                    onChange={(event) => updateDraft(index, { startDate: event.target.value })}
                  />
                </label>
                <label className="text-xs font-medium uppercase text-muted">
                  End
                  <input
                    className="control mt-2 h-10 w-full rounded-md px-3 text-sm normal-case disabled:opacity-50"
                    type="month"
                    disabled={item.isCurrent}
                    value={item.isCurrent ? '' : toMonthValue(item.endDate || '')}
                    onChange={(event) => updateDraft(index, { endDate: event.target.value || null })}
                  />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={item.isCurrent}
                    onChange={(event) =>
                      updateDraft(index, { isCurrent: event.target.checked, endDate: event.target.checked ? null : item.endDate })
                    }
                  />
                  Current role
                </label>
                <button className="text-sm text-danger hover:text-danger/80" onClick={() => removeDraft(index)}>
                  Remove
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-md border border-line bg-bg/60 p-4 text-sm text-muted">
            No experience rows yet. Upload a CV or add one manually.
          </p>
        )}
      </div>

      <button
        className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/90"
        onClick={onSave}
      >
        <CheckCircle2 size={16} />
        Save experience
      </button>
    </div>
  )
}

function calculateExperienceMonths(item: CvExperience) {
  if (!item.startDate) return 0
  const start = monthDate(item.startDate)
  const end = item.isCurrent || !item.endDate ? new Date() : monthDate(item.endDate)
  return Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1)
}

function monthDate(value: string) {
  const [year, month = 1] = value.slice(0, 7).split('-').map(Number)
  return new Date(year, month - 1, 1)
}

function toMonthValue(value: string) {
  return value ? value.slice(0, 7) : ''
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
  const liveJobSources = useJobmatchStore((state) => state.liveJobSources)
  const jobs = useJobmatchStore((state) => state.jobs)
  const fetched = liveJobSources.reduce((total, source) => total + source.count, 0)
  const failures = liveJobSources.filter((source) => !source.ok).length

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard icon={<DatabaseZap size={20} />} label="Fetched last run" value={fetched} />
        <StatCard icon={<Sparkles size={20} />} label="Workspace jobs" value={jobs.length} />
        <StatCard icon={<ShieldCheck size={20} />} label="Source failures" value={failures} />
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-line p-5">
          <h2 className="text-lg font-semibold text-ink">Job sources</h2>
          <p className="text-sm text-muted">This table reflects the latest live extraction run for your workspace.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-bg/70 text-xs uppercase text-muted">
              <tr>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Fetched</th>
                <th className="px-5 py-3">Message</th>
              </tr>
            </thead>
            <tbody>
              {liveJobSources.length ? (
                liveJobSources.map((source) => (
                  <tr key={source.name} className="border-t border-line">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-ink">{source.name}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-md px-2 py-1 text-xs ${source.ok ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
                        {source.ok ? 'success' : 'failed'}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-muted">{source.count}</td>
                    <td className="px-5 py-4 text-muted">{source.error || 'OK'}</td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-line">
                  <td className="px-5 py-6 text-sm text-muted" colSpan={4}>
                    Run live extraction from Discovery or CV Hub to populate source status.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <HealthTile label="Database" value="Healthy" icon={<DatabaseZap size={18} />} />
        <HealthTile label="Auth" value="Supabase session" icon={<UserRound size={18} />} />
        <HealthTile label="Local parser" value="PDF/DOCX/TXT" icon={<Sparkles size={18} />} />
        <HealthTile label="Live sources" value={`${liveJobSources.length || 3} configured`} icon={<Globe2 size={18} />} />
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
