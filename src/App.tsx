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
  Gauge,
  Globe2,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Moon,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Rocket,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Trash2,
  UploadCloud,
  X,
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
import type { Application, CvProfile, CvSkill, Job, LiveJobSourceResult, ParsedCvPayload, ScoredJob } from './types'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/jobs', label: 'Discovery', icon: Search },
  { to: '/cv', label: 'CV Hub', icon: FileText },
  { to: '/tracker', label: 'Tracker', icon: ClipboardList },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/admin', label: 'Admin', icon: ShieldCheck },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const brandTagline = 'Upload. Match. Apply smarter.'

type ThemeMode = 'dark' | 'light'

const countryCityOptions = [
  { country: 'Remote', cities: ['Remote'] },
  { country: 'United States', cities: ['Any city', 'New York', 'San Francisco', 'Los Angeles', 'Chicago', 'Austin', 'Seattle', 'Boston', 'Dallas', 'Denver', 'Atlanta', 'Miami'] },
  { country: 'Pakistan', cities: ['Any city', 'Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Peshawar', 'Multan', 'Hyderabad', 'Quetta'] },
  { country: 'India', cities: ['Any city', 'Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Pune', 'Chennai', 'Gurugram', 'Noida', 'Ahmedabad', 'Kolkata'] },
  { country: 'United Kingdom', cities: ['Any city', 'London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Edinburgh', 'Bristol', 'Liverpool'] },
  { country: 'Canada', cities: ['Any city', 'Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa', 'Edmonton', 'Waterloo'] },
  { country: 'United Arab Emirates', cities: ['Any city', 'Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman'] },
  { country: 'Germany', cities: ['Any city', 'Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne', 'Stuttgart', 'Dusseldorf'] },
  { country: 'Australia', cities: ['Any city', 'Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Canberra'] },
  { country: 'Singapore', cities: ['Singapore'] },
  { country: 'Saudi Arabia', cities: ['Any city', 'Riyadh', 'Jeddah', 'Dammam', 'Khobar'] },
  { country: 'Netherlands', cities: ['Any city', 'Amsterdam', 'Rotterdam', 'Utrecht', 'Eindhoven', 'The Hague'] },
  { country: 'France', cities: ['Any city', 'Paris', 'Lyon', 'Marseille', 'Toulouse', 'Lille'] },
]

function App() {
  const location = useLocation()
  const authStatus = useJobmatchStore((state) => state.authStatus)
  const initializeAuth = useJobmatchStore((state) => state.initializeAuth)
  const hasWorkspaceSnapshot = useJobmatchStore((state) =>
    Boolean(
      state.userId ||
        state.profile.id ||
        state.activeCv.id ||
        state.cvs.length ||
        state.jobs.length ||
        state.applications.length,
    ),
  )

  useEffect(() => {
    void initializeAuth()
  }, [initializeAuth])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [location.pathname])

  if (location.pathname === '/') {
    return <LandingPage />
  }

  if (authStatus === 'loading' && !hasWorkspaceSnapshot) {
    return <WorkspaceBootFrame />
  }

  if (location.pathname === '/auth' || authStatus === 'unauthenticated' || authStatus === 'error') {
    return <AuthPage />
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

function WorkspaceBootFrame() {
  useThemeMode()

  return (
    <main className="min-h-screen bg-[#101218] text-white">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="hidden border-r border-white/10 bg-[#171a27] p-4 lg:block">
          <BrandLogo onDark />
          <div className="mt-7 space-y-2">
            {navItems.slice(0, 5).map((item) => (
              <div key={item.to} className="h-12 animate-pulse rounded-md bg-white/[0.07]" />
            ))}
          </div>
        </aside>
        <section className="min-w-0">
          <header className="flex h-16 items-center justify-between border-b border-white/10 bg-[#101218]/95 px-4 md:px-6">
            <BrandLogo compact onDark />
            <div className="flex gap-3">
              <div className="h-9 w-9 animate-pulse rounded-md bg-white/10" />
              <div className="h-9 w-24 animate-pulse rounded-md bg-white/10" />
            </div>
          </header>
          <div className="space-y-5 p-4 md:p-6">
            <div className="h-32 animate-pulse rounded-md border border-white/10 bg-white/[0.08]" />
            <div className="grid gap-4 md:grid-cols-3">
              <div className="h-28 animate-pulse rounded-md border border-white/10 bg-white/[0.08]" />
              <div className="h-28 animate-pulse rounded-md border border-white/10 bg-white/[0.08]" />
              <div className="h-28 animate-pulse rounded-md border border-white/10 bg-white/[0.08]" />
            </div>
            <div className="h-72 animate-pulse rounded-md border border-white/10 bg-white/[0.08]" />
          </div>
        </section>
      </div>
    </main>
  )
}

function useThemeMode() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'dark'
    const saved = window.localStorage.getItem('jobmatcher-theme')
    return saved === 'light' ? 'light' : 'dark'
  })

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('light', theme === 'light')
    root.classList.toggle('dark', theme === 'dark')
    window.localStorage.setItem('jobmatcher-theme', theme)
  }, [theme])

  return {
    theme,
    toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
  }
}

function ThemeToggle() {
  const { theme, toggleTheme } = useThemeMode()
  const isLight = theme === 'light'

  return (
    <button
      className="icon-button"
      onClick={toggleTheme}
      aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      title={isLight ? 'Dark theme' : 'Light theme'}
    >
      {isLight ? <Moon size={17} /> : <Sun size={17} />}
    </button>
  )
}

function BrandLogo({ compact = false, onDark = false }: { compact?: boolean; onDark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-white shadow-soft">
        <BriefcaseBusiness size={22} />
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-success text-[9px] font-black text-white">
          %
        </span>
      </div>
      {!compact ? (
        <div>
          <p className={`text-lg font-extrabold leading-5 ${onDark ? 'text-white' : 'text-ink'}`}>Jobmatcher</p>
          <p className={`text-xs font-medium ${onDark ? 'text-slate-300' : 'text-muted'}`}>{brandTagline}</p>
        </div>
      ) : null}
    </div>
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
        <div className="absolute inset-0 bg-gradient-to-br from-[#070913] via-[#101422]/88 to-[#101422]/35" />

        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-8">
          <BrandLogo onDark />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NavLink
              className="inline-flex h-10 items-center gap-2 rounded-md border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white backdrop-blur transition hover:border-primary"
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
              {brandTagline} Upload your CV, add skills manually, fetch real listings, and track every application without a messy spreadsheet.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <NavLink
                className="inline-flex h-12 items-center gap-2 rounded-md bg-primary px-5 text-sm font-bold text-white shadow-soft transition hover:bg-primary/90"
                to="/auth?mode=signup"
              >
                Upload CV <ArrowRight size={17} />
              </NavLink>
              <NavLink
              className="inline-flex h-12 items-center gap-2 rounded-md border border-white/20 bg-white/10 px-5 text-sm font-bold text-white backdrop-blur transition hover:border-primary"
              to="/auth?mode=signin"
            >
                Explore jobs <Search size={17} />
              </NavLink>
            </div>
          </div>

          <div className="rounded-md border border-white/15 bg-[#101422]/95 p-4 text-white shadow-soft backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300">Live matching preview</p>
                <p className="font-semibold text-white">Senior Frontend Engineer</p>
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
                <div key={title} className="rounded-md border border-white/10 bg-black/35 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{title}</p>
                      <p className="mt-1 text-xs text-slate-400">{location}</p>
                    </div>
                    <BriefcaseBusiness className="text-primary" size={20} />
                  </div>
                  <p className="mt-3 text-xs text-slate-400">{skills}</p>
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
        setFormMessage('Account created. Signing you in now.')
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
        <div className="absolute inset-0 bg-gradient-to-br from-[#070913] via-[#101422]/86 to-[#101422]/28" />
        <div className="relative z-10 flex h-full flex-col justify-between p-10">
          <NavLink className="flex items-center gap-3" to="/">
            <BrandLogo onDark />
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
              <BrandLogo />
            </NavLink>
          </div>

          <div className="panel p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">{mode === 'signup' ? 'Create your workspace' : 'Welcome back'}</p>
                <p className="text-xs text-muted">{brandTagline}</p>
              </div>
              <ThemeToggle />
            </div>
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
                <label className="field-label">
                  Name
                  <span className="field-shell normal-case">
                    <UserRound size={16} className="text-muted" />
                    <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
                  </span>
                </label>
              ) : null}
              <label className="field-label">
                Email
                <span className="field-shell normal-case">
                  <Mail size={16} className="text-muted" />
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                  />
                </span>
              </label>
              <label className="field-label">
                Password
                <span className="field-shell normal-case">
                  <KeyRound size={16} className="text-muted" />
                  <input
                    type="password"
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    minLength={6}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Minimum 6 characters"
                  />
                </span>
              </label>
              <button
                className="primary-button h-11 w-full"
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

function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const profile = useJobmatchStore((state) => state.profile)
  const notifications = useJobmatchStore((state) => state.notifications)
  const signOut = useJobmatchStore((state) => state.signOut)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const unread = notifications.filter((notification) => !notification.isRead).length
  const pageLabel = navItems.find((item) => item.to === location.pathname)?.label ?? 'Dashboard'

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="hidden border-r border-line bg-panel/88 p-4 backdrop-blur lg:block">
          <WorkspaceNav />
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur md:px-6">
            <div className="flex items-center gap-3">
              <button className="icon-button lg:hidden" aria-label="Open navigation" title="Navigation" onClick={() => setMobileNavOpen(true)}>
                <Menu size={18} />
              </button>
              <div>
                <p className="text-xs font-medium text-muted">{brandTagline}</p>
                <h1 className="text-lg font-semibold text-ink">{pageLabel}</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
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
          {mobileNavOpen ? (
            <div className="fixed inset-0 z-40 bg-black/55 p-3 backdrop-blur-sm lg:hidden" onClick={() => setMobileNavOpen(false)}>
              <aside
                className="h-full w-full max-w-[300px] rounded-md border border-line bg-panel p-4 shadow-soft"
                onClick={(event) => event.stopPropagation()}
              >
                <WorkspaceNav />
              </aside>
            </div>
          ) : null}
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

function WorkspaceNav() {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-7">
        <BrandLogo />
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-primary/15 text-primary shadow-sm' : 'text-muted hover:bg-bg/75 hover:text-ink'
                }`
              }
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-md border border-line bg-bg/70 transition group-hover:border-primary/50">
                <Icon size={16} />
              </span>
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      <div className="mt-auto rounded-md border border-line bg-bg/65 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <DatabaseZap size={16} className="text-primary" />
          Source health
        </div>
        <p className="mt-2 text-xs leading-5 text-muted">
          Live extraction uses your CV skills, role, and private server keys to keep matching focused.
        </p>
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
    const skills = [...activeCv.skills]
      .sort((a, b) => (b.skillRank || 0) - (a.skillRank || 0))
      .map((skill) => skill.skillName)
      .filter(Boolean)
      .slice(0, 20)
    if (!skills.length) {
      setStatus('error')
      setMessage('Upload a CV or add comma-separated skills before live job search.')
      return
    }

    const query = profile.targetRole || skills.slice(0, 3).join(' ')
    const params = new URLSearchParams({
      query,
      location: profile.location || 'Remote',
      skills: skills.join(','),
      experienceYears: String(activeCv.totalYearsExperience || 0),
      limit: '40',
    })

    setStatus('loading')
    setMessage('Fetching precise matches from live sources...')

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
      setMessage(`Fetched ${payload.jobs.length} relevant jobs matched to your skills and experience.`)
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
                <span className="text-xs capitalize text-muted">{skill.confidence}</span>
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
  const deleteCv = useJobmatchStore((state) => state.deleteCv)
  const clearCvData = useJobmatchStore((state) => state.clearCvData)
  const addParsedCv = useJobmatchStore((state) => state.addParsedCv)
  const upsertSkill = useJobmatchStore((state) => state.upsertSkill)
  const removeSkill = useJobmatchStore((state) => state.removeSkill)
  const setActiveExperience = useJobmatchStore((state) => state.setActiveExperience)
  const updateProfile = useJobmatchStore((state) => state.updateProfile)
  const liveSearch = useLiveJobSearch()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [parseStatus, setParseStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [parseMessage, setParseMessage] = useState('')
  const [lastParsedCv, setLastParsedCv] = useState<ParsedCvPayload | null>(null)
  const [targetRole, setTargetRole] = useState(profile.targetRole)
  const [selectedCountry, setSelectedCountry] = useState(() => parseLocationSelection(profile.location).country)
  const [selectedCity, setSelectedCity] = useState(() => parseLocationSelection(profile.location).city)
  const [preferredRemote, setPreferredRemote] = useState(profile.preferredRemote)
  const [experienceYears, setExperienceYears] = useState(activeCv.totalYearsExperience || 0)
  const [profileMessage, setProfileMessage] = useState('')
  const [cvDataMessage, setCvDataMessage] = useState('')
  const selectedCities = getCitiesForCountry(selectedCountry)
  const selectedLocation = formatSelectedLocation(selectedCountry, selectedCity)

  useEffect(() => {
    const parsedLocation = parseLocationSelection(profile.location)
    setTargetRole(profile.targetRole)
    setSelectedCountry(parsedLocation.country)
    setSelectedCity(parsedLocation.city)
    setPreferredRemote(profile.preferredRemote)
  }, [profile.targetRole, profile.location, profile.preferredRemote])

  useEffect(() => {
    setExperienceYears(activeCv.totalYearsExperience || 0)
  }, [activeCv.totalYearsExperience])

  const saveProfileSignal = () => {
    const nextExperienceYears = clampExperienceYears(experienceYears)
    updateProfile({
      targetRole: targetRole.trim() || profile.targetRole,
      location: selectedLocation,
      preferredRemote,
    })
    setExperienceYears(nextExperienceYears)
    setActiveExperience(nextExperienceYears)

    setProfileMessage(`Saved profile signal for ${selectedLocation} with ${nextExperienceYears} years experience.`)
  }

  const searchFromCv = () => {
    saveProfileSignal()
    void liveSearch.runLiveSearch(true)
  }

  const handleDeleteCv = (cv: CvProfile) => {
    deleteCv(cv.id)
    setCvDataMessage(`${cv.label} was removed from your CV data.`)
    if (lastParsedCv?.filename === cv.filename) setLastParsedCv(null)
  }

  const handleClearCvData = () => {
    clearCvData()
    setLastParsedCv(null)
    setParseStatus('idle')
    setParseMessage('')
    setCvDataMessage('All CV versions, extracted skills, experience, and CV match data were cleared from your account.')
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
      void liveSearch.runLiveSearch(false)
    } catch (error) {
      setParseStatus('error')
      setParseMessage(error instanceof Error ? error.message : 'CV parsing failed.')
    }
  }

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="grid gap-5 bg-gradient-to-br from-primary/18 via-panel to-panel p-5 md:grid-cols-[1fr_auto] md:p-6">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
              <Gauge size={16} />
              Skills, rank, and CV signal
            </div>
            <h2 className="text-2xl font-bold text-ink md:text-3xl">CV Hub</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Upload your CV, tune the role signal, and keep every skill ranked with a draggable percentage bar.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center md:min-w-[360px]">
            <CvMetric label="Skills" value={activeCv.skills.length} />
            <CvMetric label="Avg rank" value={`${averageSkillRank(activeCv.skills)}%`} />
            <CvMetric label="Years" value={activeCv.totalYearsExperience || 0} />
          </div>
        </div>
      </section>

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
                type="button"
                className="primary-button mt-4"
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
                <p className="text-sm text-muted">Tune the role, location, and skills used for live extraction.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field-label">
                Target role
                <span className="field-shell normal-case">
                  <BriefcaseBusiness size={16} className="text-muted" />
                  <input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} placeholder="Frontend Engineer" />
                </span>
              </label>
              <label className="field-label">
                Experience years
                <span className="field-shell normal-case">
                  <BriefcaseBusiness size={16} className="text-muted" />
                  <input
                    type="number"
                    min={0}
                    max={60}
                    step={1}
                    value={experienceYears}
                    onChange={(event) => setExperienceYears(clampExperienceYears(event.target.value))}
                    placeholder="5"
                  />
                </span>
              </label>
              <label className="field-label">
                Country
                <span className="field-shell normal-case">
                  <Globe2 size={16} className="text-muted" />
                  <select
                    value={selectedCountry}
                    onChange={(event) => {
                      const country = event.target.value
                      setSelectedCountry(country)
                      setSelectedCity(getCitiesForCountry(country)[0] || '')
                    }}
                  >
                    {countryCityOptions.map((option) => (
                      <option key={option.country} value={option.country}>
                        {option.country}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <label className="field-label">
                City
                <span className="field-shell normal-case">
                  <MapPin size={16} className="text-muted" />
                  <select
                    value={selectedCity}
                    onChange={(event) => setSelectedCity(event.target.value)}
                  >
                    {selectedCities.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <label className="flex min-h-11 items-center gap-3 rounded-md border border-line bg-bg/70 px-3 text-sm font-medium text-ink transition hover:border-primary/60 sm:mt-6">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={preferredRemote}
                  onChange={(event) => setPreferredRemote(event.target.checked)}
                />
                Remote preferred
              </label>
            </div>
            <div className="field-label mt-4">
              Matching note
              <p className="mt-2 rounded-md border border-line bg-bg/60 p-3 text-sm normal-case leading-6 text-muted">
                Skill editing and ranking is handled below. Job search uses the active CV skills, rank signal, target role, and location.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="secondary-button"
                onClick={saveProfileSignal}
              >
                <Plus size={16} />
                Save signal
              </button>
              <button
                type="button"
                className="primary-button"
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
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <h2 className="text-lg font-semibold text-ink">CV versions</h2>
                <p className="mt-1 text-sm text-muted">Every CV row belongs to this signed-in user account.</p>
              </div>
              <button
                type="button"
                className="secondary-button border-danger/45 text-danger hover:border-danger hover:bg-danger/10"
                disabled={!cvs.length}
                onClick={handleClearCvData}
              >
                <Trash2 size={16} />
                Clear all CV data
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {cvs.length ? (
                cvs.map((cv) => (
                  <article
                    key={cv.id}
                    className={`rounded-md border p-4 transition ${
                      cv.isActive ? 'border-primary bg-primary/10' : 'border-line bg-bg/60 hover:border-primary'
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-ink">{cv.label}</p>
                        <p className="mt-1 text-xs text-muted">
                          v{cv.version} · {cv.parseStatus} · {cv.skills.length} skills · {cv.totalYearsExperience || 0} years
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {cv.isActive ? (
                          <span className="inline-flex h-9 items-center rounded-md bg-success/15 px-3 text-xs font-semibold text-success">
                            Active
                          </span>
                        ) : (
                          <button type="button" className="secondary-button h-9 px-3" onClick={() => activateCv(cv.id)}>
                            <CheckCircle2 size={15} />
                            Activate
                          </button>
                        )}
                        <button
                          type="button"
                          className="secondary-button h-9 border-danger/45 px-3 text-danger hover:border-danger hover:bg-danger/10"
                          onClick={() => handleDeleteCv(cv)}
                        >
                          <Trash2 size={15} />
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-md border border-line bg-bg/60 p-4 text-sm text-muted">
                  No CV uploaded yet. Upload a CV or save manual skills to create your first profile signal.
                </p>
              )}
            </div>
            {cvDataMessage ? <p className="mt-3 text-xs text-muted">{cvDataMessage}</p> : null}
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <h2 className="text-lg font-semibold text-ink">Skills editor</h2>
            <p className="mt-1 text-sm text-muted">Add, update, remove, and rank each skill from 0% to 100%.</p>
          </div>
          <span className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
            {activeCv.skills.length} active skills
          </span>
        </div>
        {lastParsedCv?.warnings.length ? (
          <div className="mt-4 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
            {lastParsedCv.warnings.join(' ')}
          </div>
        ) : null}
        <SkillManager
          skills={activeCv.skills}
          onSaveSkill={upsertSkill}
          onRemoveSkill={removeSkill}
        />
      </section>

      <section>
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

function parseLocationSelection(location: string) {
  const raw = location.trim()
  if (!raw || raw.toLowerCase() === 'remote') return { country: 'Remote', city: 'Remote' }

  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean)
  const countryFromParts = parts[1] || parts[0]
  const directCountry = countryCityOptions.find((option) => option.country.toLowerCase() === countryFromParts.toLowerCase())
  if (directCountry) {
    const city = parts[1] ? parts[0] : directCountry.cities[0]
    return {
      country: directCountry.country,
      city: directCountry.cities.includes(city) ? city : directCountry.cities[0],
    }
  }

  const cityMatch = countryCityOptions.find((option) =>
    option.cities.some((city) => city.toLowerCase() === raw.toLowerCase()),
  )

  if (cityMatch) return { country: cityMatch.country, city: raw }

  return { country: 'Remote', city: 'Remote' }
}

function getCitiesForCountry(country: string) {
  return countryCityOptions.find((option) => option.country === country)?.cities || ['Any city']
}

function formatSelectedLocation(country: string, city: string) {
  if (country === 'Remote') return 'Remote'
  if (!city || city === 'Any city') return country
  return `${city}, ${country}`
}

function clampExperienceYears(value: number | string) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.min(Math.max(Math.round(number), 0), 60)
}

const skillTypeOptions: CvSkill['skillType'][] = ['technical', 'framework', 'tool', 'soft', 'language', 'certification']

function CvMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-line bg-bg/65 p-4">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
    </div>
  )
}

function SkillManager({
  skills,
  onSaveSkill,
  onRemoveSkill,
}: {
  skills: CvSkill[]
  onSaveSkill: (skill: CvSkill, previousCanonical?: string) => void
  onRemoveSkill: (skillCanonical: string) => void
}) {
  const [newSkill, setNewSkill] = useState('')
  const [newRank, setNewRank] = useState(75)
  const [newType, setNewType] = useState<CvSkill['skillType']>('technical')
  const sortedSkills = useMemo(
    () => [...skills].sort((a, b) => (b.skillRank || 0) - (a.skillRank || 0) || a.skillName.localeCompare(b.skillName)),
    [skills],
  )

  const addSkills = () => {
    const names = newSkill
      .split(',')
      .map((skill) => skill.trim())
      .filter(Boolean)
    if (!names.length) return

    names.forEach((name) =>
      onSaveSkill({
        skillName: name,
        skillCanonical: name,
        skillType: newType,
        yearsUsed: 0,
        skillRank: newRank,
        confidence: rankToConfidenceLabel(newRank),
        isManual: true,
      }),
    )
    setNewSkill('')
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="grid gap-3 rounded-md border border-line bg-bg/60 p-4 lg:grid-cols-[minmax(0,1fr)_180px_220px_auto] lg:items-end">
        <label className="field-label">
          Add skill
          <span className="field-shell normal-case">
            <Sparkles size={16} className="text-muted" />
            <input
              value={newSkill}
              onChange={(event) => setNewSkill(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addSkills()
                }
              }}
              placeholder="React, TypeScript, Node.js"
            />
          </span>
        </label>
        <label className="field-label">
          Type
          <select
            className="control mt-2 h-11 w-full rounded-md px-3 text-sm normal-case"
            value={newType}
            onChange={(event) => setNewType(event.target.value as CvSkill['skillType'])}
          >
            {skillTypeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <SkillRankSlider label="Initial rank" value={newRank} onChange={setNewRank} />
        <button type="button" className="primary-button h-11" onClick={addSkills}>
          <Plus size={16} />
          Add
        </button>
      </div>

      {sortedSkills.length ? (
        <div className="grid gap-3">
          {sortedSkills.map((skill) => (
            <SkillEditorRow
              key={skill.skillCanonical}
              skill={skill}
              onSaveSkill={onSaveSkill}
              onRemoveSkill={onRemoveSkill}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-line bg-bg/50 p-8 text-center">
          <Sparkles className="mx-auto text-primary" size={28} />
          <p className="mt-3 font-semibold text-ink">No skills yet</p>
          <p className="mt-1 text-sm text-muted">Upload a CV or add comma-separated skills above.</p>
        </div>
      )}
    </div>
  )
}

function SkillEditorRow({
  skill,
  onSaveSkill,
  onRemoveSkill,
}: {
  skill: CvSkill
  onSaveSkill: (skill: CvSkill, previousCanonical?: string) => void
  onRemoveSkill: (skillCanonical: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftName, setDraftName] = useState(skill.skillName)
  const [draftType, setDraftType] = useState<CvSkill['skillType']>(skill.skillType)
  const [rank, setRank] = useState(skill.skillRank || 70)

  useEffect(() => {
    setDraftName(skill.skillName)
    setDraftType(skill.skillType)
    setRank(skill.skillRank || 70)
  }, [skill.skillName, skill.skillRank, skill.skillType])

  const save = (nextRank = rank) => {
    const name = draftName.trim()
    if (!name) return
    onSaveSkill(
      {
        ...skill,
        skillName: name,
        skillCanonical: name,
        skillType: draftType,
        skillRank: nextRank,
        confidence: rankToConfidenceLabel(nextRank),
        isManual: true,
      },
      skill.skillCanonical,
    )
    setIsEditing(false)
  }

  const updateRank = (nextRank: number) => {
    setRank(nextRank)
  }

  return (
    <article className="rounded-md border border-line bg-bg/60 p-4 transition hover:border-primary/50">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.9fr)_auto] lg:items-center">
        <div className="min-w-0">
          {isEditing ? (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
              <label className="field-label">
                Skill
                <input
                  className="control mt-2 h-10 w-full rounded-md px-3 text-sm normal-case"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                />
              </label>
              <label className="field-label">
                Type
                <select
                  className="control mt-2 h-10 w-full rounded-md px-3 text-sm normal-case"
                  value={draftType}
                  onChange={(event) => setDraftType(event.target.value as CvSkill['skillType'])}
                >
                  {skillTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-ink">{skill.skillName}</h3>
                <span className="rounded-md border border-line bg-panel px-2 py-1 text-xs capitalize text-muted">
                  {skill.skillType}
                </span>
              </div>
              <p className="mt-1 text-xs capitalize text-muted">{skill.confidence} confidence</p>
            </>
          )}
        </div>

        <SkillRankSlider
          label="Skill rank"
          value={rank}
          onChange={updateRank}
          onCommit={(nextRank) => save(nextRank)}
        />

        <div className="flex items-center gap-2 lg:justify-end">
          {isEditing ? (
            <>
              <button
                type="button"
                className="icon-button"
                onClick={() => save()}
                aria-label={`Save ${skill.skillName}`}
                title="Save"
              >
                <Save size={16} />
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  setDraftName(skill.skillName)
                  setDraftType(skill.skillType)
                  setRank(skill.skillRank || 70)
                  setIsEditing(false)
                }}
                aria-label="Cancel edit"
                title="Cancel"
              >
                <X size={16} />
              </button>
            </>
          ) : (
            <button
              type="button"
              className="icon-button"
              onClick={() => setIsEditing(true)}
              aria-label={`Edit ${skill.skillName}`}
              title="Edit"
            >
              <Pencil size={16} />
            </button>
          )}
          <button
            type="button"
            className="icon-button hover:border-danger hover:bg-danger/10 hover:text-danger"
            onClick={() => onRemoveSkill(skill.skillCanonical)}
            aria-label={`Remove ${skill.skillName}`}
            title="Remove"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </article>
  )
}

function SkillRankSlider({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  onCommit?: (value: number) => void
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold uppercase text-muted">
        <span>{label}</span>
        <span className="font-mono text-primary">{value}%</span>
      </div>
      <input
        className="skill-range w-full"
        style={{ '--rank': `${value}%` } as React.CSSProperties}
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onMouseUp={(event) => onCommit?.(Number(event.currentTarget.value))}
        onTouchEnd={(event) => onCommit?.(Number(event.currentTarget.value))}
        onBlur={(event) => onCommit?.(Number(event.currentTarget.value))}
        aria-label={label}
      />
    </label>
  )
}

function averageSkillRank(skills: CvSkill[]) {
  if (!skills.length) return 0
  return Math.round(skills.reduce((total, skill) => total + (skill.skillRank || 0), 0) / skills.length)
}

function rankToConfidenceLabel(rank: number): CvSkill['confidence'] {
  if (rank >= 78) return 'high'
  if (rank >= 45) return 'medium'
  return 'low'
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
