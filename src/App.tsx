import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Cpu,
  DatabaseZap,
  Eye,
  EyeOff,
  FileText,
  Gauge,
  Globe2,
  KeyRound,
  Layers,
  LayoutDashboard,
  Lock,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Moon,
  MousePointerClick,
  Network,
  Pencil,
  Plus,
  Quote,
  Radio,
  RefreshCw,
  Rocket,
  Save,
  ScanSearch,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Target,
  Trash2,
  TrendingUp,
  UploadCloud,
  X,
  UserPlus,
  UserRound,
  Zap,
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
import { AnimatePresence, motion } from 'framer-motion'
import { formatDistanceToNowStrict } from 'date-fns'
import { FilterPanel } from './components/FilterPanel'
import { JobCard } from './components/JobCard'
import { JobDetailPanel } from './components/JobDetailPanel'
import { KanbanBoard } from './components/KanbanBoard'
import { PrettySelect } from './components/PrettySelect'
import { AuroraBackground } from './components/landing/AuroraBackground'
import { Marquee } from './components/landing/Marquee'
import { Reveal } from './components/landing/Reveal'
import { SpotlightCard } from './components/landing/SpotlightCard'
import { CountUp } from './components/landing/CountUp'
import { MatchScoreRing } from './components/landing/MatchScoreRing'
import { MagneticButton } from './components/landing/MagneticButton'
import { LandingFooter } from './components/landing/LandingFooter'
import {
  getProfileCompletion,
  isProfileComplete,
  joinPreferenceText,
  normaliseRemotePreference,
  profileSearchLocation,
  profileSearchSkills,
  splitPreferenceText,
  usefulPreferenceTerms,
} from './lib/profilePreferences'
import { filterAndSortJobs, scoreJobs } from './lib/scoring'
import { defaultFilters } from './lib/defaults'
import { useJobmatchStore } from './store/useJobmatchStore'
import type { Application, CvProfile, CvSkill, Job, LiveJobSourceResult, ParsedCvPayload, RemotePreference, ScoredJob, UserProfile } from './types'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/profile', label: 'Profile', icon: UserRound },
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
  const workspaceStatus = useJobmatchStore((state) => state.workspaceStatus)
  const profile = useJobmatchStore((state) => state.profile)
  const recoveryMode = useJobmatchStore((state) => state.recoveryMode)
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

  // A password-recovery link takes over the screen until a new password is set.
  if (recoveryMode) {
    return <AuthPage />
  }

  if (authStatus === 'loading' && !hasWorkspaceSnapshot) {
    return <WorkspaceBootFrame />
  }

  if (location.pathname === '/auth' || authStatus === 'unauthenticated' || authStatus === 'error') {
    return <AuthPage />
  }

  if (authStatus === 'authenticated' && workspaceStatus !== 'loading' && !isProfileComplete(profile) && location.pathname !== '/profile') {
    return <Navigate to="/profile" replace state={{ from: location.pathname }} />
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/jobs" element={<JobDiscoveryPage />} />
        <Route path="/cv" element={<CvHubPage />} />
        <Route path="/tracker" element={<TrackerPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
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

const ROTATING_WORDS = ['fit your CV', 'match your skills', 'match your ambition', 'are worth your time']

const LANDING_NAV = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how' },
  { label: 'Sources', href: '#sources' },
  { label: 'Security', href: '#security' },
]

const LANDING_SERVICES = [
  {
    icon: LayoutDashboard,
    title: 'Command dashboard',
    text: 'Live KPIs, search momentum, an application funnel, and a skills-gap read — your whole job hunt at a glance.',
    accent: 'var(--color-primary)',
  },
  {
    icon: Target,
    title: 'Role & skill targeting',
    text: 'Define target roles, locations, salary, and must-haves. These rules decide exactly what enters your feed.',
    accent: 'var(--color-cyan)',
  },
  {
    icon: ScanSearch,
    title: 'AI-ranked discovery',
    text: 'Pull real listings from live sources, then sort score-first cards with advanced filters and a detail panel.',
    accent: 'var(--color-success)',
  },
  {
    icon: FileText,
    title: 'Local CV hub',
    text: 'Parse PDF, DOCX, DOC, and TXT on-device. Edit extracted experience, manage skills, and switch active CVs.',
    accent: 'var(--color-primary)',
  },
  {
    icon: ClipboardList,
    title: 'Kanban tracker',
    text: 'Drag applications across saved, applied, interview, and offer columns — then export the pipeline to CSV.',
    accent: 'var(--color-cyan)',
  },
  {
    icon: Bell,
    title: 'Smart alerts',
    text: 'Saved-search notifications and reminders keep fresh, high-fit roles in front of you without manual checks.',
    accent: 'var(--color-warning)',
  },
  {
    icon: Network,
    title: 'Source health',
    text: 'Admin view of every connected job source so you always know which feeds are returning fresh results.',
    accent: 'var(--color-success)',
  },
  {
    icon: ShieldCheck,
    title: 'Security & control',
    text: 'Supabase Auth with row-level security, sanitized job HTML, and GDPR-ready export and deletion flows.',
    accent: 'var(--color-primary)',
  },
]

const LANDING_STEPS = [
  {
    icon: UploadCloud,
    step: '01',
    title: 'Upload your CV',
    text: 'Drop a PDF, DOCX, DOC, or TXT. Parsing runs locally to build a structured skill and experience profile.',
  },
  {
    icon: Target,
    step: '02',
    title: 'Set your target',
    text: 'Tune role, location, salary, and must-have skills. Add good and bad examples to sharpen relevance.',
  },
  {
    icon: Cpu,
    step: '03',
    title: 'Get ranked matches',
    text: 'Live roles are scored against your skills, experience, location, and freshness — best fit floats to the top.',
  },
  {
    icon: ClipboardList,
    step: '04',
    title: 'Apply & track',
    text: 'Save, apply, and move each role across your kanban board, then export the whole pipeline whenever you like.',
  },
]

const JOB_SOURCES = [
  'Google Jobs',
  'LinkedIn',
  'Indeed',
  'Adzuna',
  'Jooble',
  'RemoteOK',
  'We Work Remotely',
  'Glassdoor',
  'Apify',
  'RapidAPI',
]

const LANDING_STATS = [
  { value: 6, suffix: '', label: 'Live job sources wired in' },
  { value: 8, suffix: '', label: 'Connected workspace modules' },
  { value: 4, suffix: '', label: 'CV formats parsed locally' },
  { value: 100, suffix: '%', label: 'Scoped to your own account' },
]

const TESTIMONIALS = [
  { quote: 'Uploaded my CV and instantly saw roles ranked by real fit. No more endless scrolling.', name: 'Ayesha K.', role: 'Frontend Engineer' },
  { quote: 'The kanban tracker finally replaced my messy spreadsheet. Drag, drop, export — done.', name: 'Daniel R.', role: 'Product Designer' },
  { quote: 'Match scores are honest. I stopped wasting time on roles that were never going to fit.', name: 'Sofia M.', role: 'Data Analyst' },
  { quote: 'Local CV parsing means my data never leaves my account. That sold me immediately.', name: 'Marcus T.', role: 'Backend Engineer' },
  { quote: 'Live sources in one feed saved me from juggling five job boards every morning.', name: 'Priya N.', role: 'DevOps Engineer' },
  { quote: 'Alerts surface fresh, high-fit roles before they get buried. Genuinely useful.', name: 'Liam O.', role: 'Mobile Developer' },
]

const SECURITY_PILLARS = [
  { icon: Lock, title: 'JWT + Row-Level Security', text: 'Every record maps to Supabase RLS policies, so your data is scoped to your account by default.' },
  { icon: ShieldCheck, title: 'Sanitized job content', text: 'Listing HTML is cleaned with DOMPurify before it ever renders in your workspace.' },
  { icon: FileText, title: 'Local-first CV parsing', text: 'CV files are parsed on-device — your resume content stays under your control.' },
  { icon: BadgeCheck, title: 'GDPR-ready flows', text: 'Account export and deletion paths are represented across the schema and docs.' },
]

const PREVIEW_JOBS = [
  { title: 'React Platform Engineer', company: 'Northwind', location: 'Remote', score: 96 },
  { title: 'Product Frontend Engineer', company: 'Lumen Labs', location: 'Hybrid · Berlin', score: 91 },
  { title: 'AI Workflow Developer', company: 'Cortex', location: 'Remote', score: 88 },
]

function RotatingWord() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setIndex((current) => (current + 1) % ROTATING_WORDS.length), 2600)
    return () => clearInterval(id)
  }, [])

  return (
    <span className="relative inline-block align-bottom">
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          className="gradient-text animate-gradient-x inline-block"
          initial={{ y: '0.5em', opacity: 0, filter: 'blur(8px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: '-0.5em', opacity: 0, filter: 'blur(8px)' }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          {ROTATING_WORDS[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

function LandingPage() {
  useEffect(() => {
    const root = document.documentElement
    const previous = root.style.scrollBehavior
    root.style.scrollBehavior = 'smooth'
    return () => {
      root.style.scrollBehavior = previous
    }
  }, [])

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-bg text-ink">
      {/* ===== Sticky nav ===== */}
      <header className="sticky top-0 z-50 border-b border-line/60 bg-bg/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5 md:px-8">
          <BrandLogo />
          <nav className="hidden items-center gap-1 lg:flex">
            {LANDING_NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-muted transition hover:bg-panel hover:text-ink"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NavLink
              className="hidden h-10 items-center gap-2 rounded-lg border border-line bg-panel/70 px-4 text-sm font-semibold text-ink transition hover:border-primary hover:text-primary sm:inline-flex"
              to="/auth?mode=signin"
            >
              <LogIn size={16} /> Sign in
            </NavLink>
            <MagneticButton>
              <NavLink
                className="group inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-glow transition hover:bg-primary/90"
                to="/auth?mode=signup"
              >
                Get started <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </NavLink>
            </MagneticButton>
          </div>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden">
        <AuroraBackground />
        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-16 md:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:pt-24">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3.5 py-1.5 text-sm font-medium text-success"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-success" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Local CV parsing + live job extraction
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
              className="mt-5 text-5xl font-extrabold leading-[1.05] tracking-tight md:text-7xl"
            >
              Find the jobs that
              <br />
              <RotatingWord />.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.16 }}
              className="mt-6 max-w-xl text-lg leading-8 text-muted"
            >
              {brandTagline} Upload your CV once, surface real listings ranked by fit, and track every application — without a messy spreadsheet.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.24 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <MagneticButton>
                <NavLink
                  className="group inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-white shadow-glow transition hover:bg-primary/90"
                  to="/auth?mode=signup"
                >
                  <UploadCloud size={18} /> Upload your CV
                  <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                </NavLink>
              </MagneticButton>
              <NavLink
                className="group inline-flex h-12 items-center gap-2 rounded-xl border border-line bg-panel/70 px-6 text-sm font-bold text-ink backdrop-blur transition hover:border-primary hover:text-primary"
                to="/auth?mode=signin"
              >
                <Search size={17} /> Explore jobs
              </NavLink>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.34 }}
              className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3"
            >
              <div className="flex -space-x-3">
                {[
                  ['AK', 'bg-primary'],
                  ['DR', 'bg-success'],
                  ['SM', 'bg-cyan'],
                  ['MT', 'bg-warning'],
                ].map(([initials, color]) => (
                  <span
                    key={initials}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-bg text-xs font-bold text-white ${color}`}
                  >
                    {initials}
                  </span>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1 text-warning">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={15} className="fill-current" />
                  ))}
                  <span className="ml-1.5 text-sm font-semibold text-ink">4.9/5</span>
                </div>
                <p className="text-xs text-muted">Built for focused, self-directed job seekers</p>
              </div>
            </motion.div>
          </div>

          {/* Preview card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative mx-auto w-full max-w-md"
          >
            {/* floating badges */}
            <motion.div
              className="absolute -left-4 top-10 z-20 hidden rounded-xl border border-line bg-panel/90 px-3 py-2 shadow-soft backdrop-blur sm:flex"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                <TrendingUp size={15} className="text-success" /> +128 new today
              </div>
            </motion.div>
            <motion.div
              className="absolute -right-4 bottom-16 z-20 hidden rounded-xl border border-line bg-panel/90 px-3 py-2 shadow-soft backdrop-blur sm:flex"
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                <CheckCircle2 size={15} className="text-primary" /> CV parsed locally
              </div>
            </motion.div>

            <div className="glass rounded-3xl p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-success" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                  </span>
                  Live match preview
                </div>
                <Sparkles size={16} className="text-primary" />
              </div>

              <div className="mt-4 flex items-center gap-4">
                <MatchScoreRing score={96} size={104} stroke={9} />
                <div>
                  <p className="text-xs text-muted">Top match in your feed</p>
                  <p className="text-base font-bold text-ink">Senior Frontend Engineer</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted">
                    <MapPin size={12} /> Remote · Full-time
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-2.5">
                {PREVIEW_JOBS.map((job, i) => (
                  <motion.div
                    key={job.title}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.5 + i * 0.12 }}
                    className="rounded-xl border border-line bg-bg/50 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{job.title}</p>
                        <p className="truncate text-xs text-muted">
                          {job.company} · {job.location}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-sm font-bold text-success">{job.score}%</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-primary via-cyan to-success"
                        initial={{ width: 0 }}
                        animate={{ width: `${job.score}%` }}
                        transition={{ duration: 1, delay: 0.7 + i * 0.12, ease: 'easeOut' }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {['React', 'TypeScript', 'Node.js', 'GraphQL', '+6'].map((skill) => (
                  <span key={skill} className="rounded-full border border-line bg-panel/60 px-2.5 py-1 text-[11px] font-medium text-muted">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== Sources marquee ===== */}
      <section id="sources" className="scroll-mt-24 border-y border-line/60 bg-panel/30 py-10">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted">
            Aggregating live roles from your configured sources
          </p>
        </div>
        <div className="mt-7">
          <Marquee speed={38} className="py-1">
            {JOB_SOURCES.map((source) => (
              <div
                key={source}
                className="mx-3 flex items-center gap-2.5 rounded-2xl border border-line bg-panel/60 px-5 py-3 text-sm font-semibold text-ink/80 transition hover:border-primary/40 hover:text-ink"
              >
                <Globe2 size={16} className="text-primary" />
                {source}
              </div>
            ))}
          </Marquee>
        </div>
      </section>

      {/* ===== Stats ===== */}
      <section className="mx-auto max-w-7xl px-5 py-16 md:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LANDING_STATS.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 0.08}>
              <div className="rounded-2xl border border-line bg-panel/50 p-6 text-center">
                <p className="text-4xl font-extrabold tracking-tight text-ink md:text-5xl">
                  <CountUp to={stat.value} suffix={stat.suffix} />
                </p>
                <p className="mt-2 text-sm text-muted">{stat.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== Services / Features ===== */}
      <section id="features" className="scroll-mt-24 mx-auto max-w-7xl px-5 py-12 md:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
            <Layers size={14} /> Everything in one workspace
          </span>
          <h2 className="mt-5 text-4xl font-extrabold tracking-tight md:text-5xl">
            One place to <span className="gradient-text">discover, match, and track</span>
          </h2>
          <p className="mt-4 text-lg text-muted">
            Eight connected modules turn a scattered job hunt into a single, focused pipeline.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {LANDING_SERVICES.map((service, i) => {
            const Icon = service.icon
            return (
              <Reveal key={service.title} delay={(i % 4) * 0.07}>
                <SpotlightCard glow={service.accent} className="h-full p-6">
                  <div
                    className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-soft transition-transform duration-300 group-hover:-translate-y-1"
                    style={{ background: `rgb(${service.accent})` }}
                  >
                    <Icon size={22} />
                  </div>
                  <h3 className="text-lg font-bold text-ink">{service.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{service.text}</p>
                </SpotlightCard>
              </Reveal>
            )
          })}
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section id="how" className="scroll-mt-24 relative overflow-hidden py-20">
        <AuroraBackground withGrid={false} className="opacity-60" />
        <div className="relative z-10 mx-auto max-w-7xl px-5 md:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-cyan">
              <MousePointerClick size={14} /> Four steps
            </span>
            <h2 className="mt-5 text-4xl font-extrabold tracking-tight md:text-5xl">From CV to offer, faster</h2>
            <p className="mt-4 text-lg text-muted">A guided flow that takes you from upload to a tracked application.</p>
          </Reveal>

          <div className="relative mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="pointer-events-none absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-line to-transparent lg:block" />
            {LANDING_STEPS.map((item, i) => {
              const Icon = item.icon
              return (
                <Reveal key={item.step} delay={i * 0.1}>
                  <div className="relative h-full rounded-2xl border border-line bg-panel/60 p-6 backdrop-blur">
                    <div className="flex items-center justify-between">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
                        <Icon size={24} />
                      </div>
                      <span className="font-mono text-2xl font-black text-line">{item.step}</span>
                    </div>
                    <h3 className="mt-5 text-lg font-bold text-ink">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">{item.text}</p>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* ===== Match scoring showcase ===== */}
      <section className="mx-auto max-w-7xl px-5 py-12 md:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal direction="right">
            <span className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-success">
              <Gauge size={14} /> Deterministic scoring
            </span>
            <h2 className="mt-5 text-4xl font-extrabold tracking-tight md:text-5xl">
              Match scores you can <span className="gradient-text">actually trust</span>
            </h2>
            <p className="mt-4 text-lg leading-8 text-muted">
              Every role is scored against your ranked skills, years of experience, target role, location, and how fresh
              the listing is. No black box — just a transparent fit signal that puts the right roles first.
            </p>
            <ul className="mt-7 space-y-3">
              {[
                'Skills overlap weighted by your confidence ranking',
                'Experience and seniority alignment',
                'Location, remote preference, and salary fit',
                'Freshness boost for newly posted roles',
              ].map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                    <Check size={13} />
                  </span>
                  <span className="text-sm text-ink/90">{point}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal direction="left">
            <div className="glass rounded-3xl p-7 shadow-soft">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">Score breakdown</p>
                <span className="rounded-md border border-success/30 bg-success/10 px-2.5 py-1 font-mono text-sm font-bold text-success">
                  94% fit
                </span>
              </div>
              <div className="mt-6 space-y-5">
                {[
                  { label: 'Skills match', value: 96, icon: Zap },
                  { label: 'Experience', value: 88, icon: Activity },
                  { label: 'Location & remote', value: 92, icon: MapPin },
                  { label: 'Freshness', value: 80, icon: TrendingUp },
                ].map((row, i) => {
                  const RowIcon = row.icon
                  return (
                    <div key={row.label}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="inline-flex items-center gap-2 font-medium text-ink">
                          <RowIcon size={15} className="text-primary" /> {row.label}
                        </span>
                        <span className="font-mono font-semibold text-muted">{row.value}%</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-line">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-primary via-cyan to-success"
                          initial={{ width: 0 }}
                          whileInView={{ width: `${row.value}%` }}
                          viewport={{ once: true, amount: 0.6 }}
                          transition={{ duration: 1, delay: i * 0.12, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===== Testimonials marquee ===== */}
      <section className="overflow-hidden py-16">
        <Reveal className="mx-auto mb-10 max-w-2xl px-5 text-center md:px-8">
          <h2 className="text-4xl font-extrabold tracking-tight md:text-5xl">Loved by focused job seekers</h2>
          <p className="mt-4 text-lg text-muted">Real workflows, fewer tabs, calmer applications.</p>
        </Reveal>
        <Marquee speed={50} reverse>
          {TESTIMONIALS.map((item) => (
            <figure
              key={item.name}
              className="mx-3 flex w-[340px] shrink-0 flex-col justify-between rounded-2xl border border-line bg-panel/60 p-6"
            >
              <Quote size={22} className="text-primary/50" />
              <blockquote className="mt-3 text-sm leading-6 text-ink/90">“{item.quote}”</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                  {item.name.split(' ').map((part) => part[0]).join('')}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{item.name}</p>
                  <p className="text-xs text-muted">{item.role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </Marquee>
      </section>

      {/* ===== Security ===== */}
      <section id="security" className="scroll-mt-24 mx-auto max-w-7xl px-5 py-12 md:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <Reveal direction="right">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
              <ShieldCheck size={14} /> Security by default
            </span>
            <h2 className="mt-5 text-4xl font-extrabold tracking-tight md:text-5xl">Your data, your account, your rules</h2>
            <p className="mt-4 text-lg leading-8 text-muted">
              Authentication, row-level security, content sanitization, and local CV parsing are wired in from the start —
              not bolted on later.
            </p>
            <MagneticButton className="mt-8 inline-block">
              <NavLink
                className="group inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-white shadow-glow transition hover:bg-primary/90"
                to="/auth?mode=signup"
              >
                Create your workspace <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
              </NavLink>
            </MagneticButton>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2">
            {SECURITY_PILLARS.map((pillar, i) => {
              const Icon = pillar.icon
              return (
                <Reveal key={pillar.title} delay={(i % 2) * 0.08}>
                  <div className="h-full rounded-2xl border border-line bg-panel/60 p-6">
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-success/15 text-success">
                      <Icon size={20} />
                    </div>
                    <h3 className="text-base font-bold text-ink">{pillar.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">{pillar.text}</p>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* ===== Final CTA ===== */}
      <section className="mx-auto max-w-7xl px-5 py-12 md:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-line bg-panel/50 px-6 py-16 text-center md:px-12">
            <AuroraBackground withGrid={false} />
            <div className="relative z-10 mx-auto max-w-2xl">
              <h2 className="text-4xl font-extrabold tracking-tight md:text-6xl">
                Stop scrolling. <span className="gradient-text">Start matching.</span>
              </h2>
              <p className="mt-5 text-lg text-muted">
                Upload your CV, fetch live roles ranked by fit, and run your whole application pipeline from one workspace.
              </p>
              <div className="mt-9 flex flex-wrap justify-center gap-3">
                <MagneticButton>
                  <NavLink
                    className="group inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-7 text-sm font-bold text-white shadow-glow transition hover:bg-primary/90"
                    to="/auth?mode=signup"
                  >
                    <UserPlus size={18} /> Get started free
                    <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                  </NavLink>
                </MagneticButton>
                <NavLink
                  className="inline-flex h-12 items-center gap-2 rounded-xl border border-line bg-bg/60 px-7 text-sm font-bold text-ink backdrop-blur transition hover:border-primary hover:text-primary"
                  to="/auth?mode=signin"
                >
                  <LogIn size={17} /> Sign in
                </NavLink>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <LandingFooter />
    </main>
  )
}

const AUTH_HIGHLIGHTS = [
  {
    icon: ScanSearch,
    title: 'AI-ranked discovery',
    text: 'Live roles sorted by real fit against your CV, skills, and targets.',
  },
  {
    icon: FileText,
    title: 'Local CV parsing',
    text: 'PDF, DOCX, DOC, and TXT parsed on-device — your data stays yours.',
  },
  {
    icon: ClipboardList,
    title: 'One pipeline',
    text: 'Move every application from saved to offer, then export to CSV.',
  },
]

const AUTH_STATS = [
  { value: '6', label: 'Live sources' },
  { value: '8', label: 'Modules' },
  { value: '100%', label: 'Yours' },
]

function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryMode = new URLSearchParams(location.search).get('mode')
  const authStatus = useJobmatchStore((state) => state.authStatus)
  const workspaceStatus = useJobmatchStore((state) => state.workspaceStatus)
  const profile = useJobmatchStore((state) => state.profile)
  const authMessage = useJobmatchStore((state) => state.authMessage)
  const recoveryMode = useJobmatchStore((state) => state.recoveryMode)
  const signIn = useJobmatchStore((state) => state.signIn)
  const signUp = useJobmatchStore((state) => state.signUp)
  const signOut = useJobmatchStore((state) => state.signOut)
  const requestPasswordReset = useJobmatchStore((state) => state.requestPasswordReset)
  const updatePassword = useJobmatchStore((state) => state.updatePassword)
  const clearRecoveryMode = useJobmatchStore((state) => state.clearRecoveryMode)
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>(
    queryMode === 'signup' ? 'signup' : queryMode === 'reset' ? 'reset' : 'signin',
  )
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formMessage, setFormMessage] = useState('')
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const [pending, setPending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [highlight, setHighlight] = useState(0)

  const screen: 'signin' | 'signup' | 'reset' | 'recovery' = recoveryMode ? 'recovery' : mode

  useEffect(() => {
    if (!recoveryMode && authStatus === 'authenticated' && workspaceStatus === 'ready') {
      navigate(isProfileComplete(profile) ? '/dashboard' : '/profile')
    }
  }, [recoveryMode, authStatus, workspaceStatus, profile, navigate])

  useEffect(() => {
    const id = setInterval(() => setHighlight((current) => (current + 1) % AUTH_HIGHLIGHTS.length), 3400)
    return () => clearInterval(id)
  }, [])

  const passwordStrength = useMemo(() => {
    let score = 0
    if (password.length >= 6) score += 1
    if (password.length >= 10) score += 1
    if (/[0-9]/.test(password)) score += 1
    if (/[^A-Za-z0-9]/.test(password)) score += 1
    return score
  }, [password])

  const strengthMeta = ['Too short', 'Weak', 'Fair', 'Good', 'Strong']

  const switchMode = (next: 'signin' | 'signup' | 'reset') => {
    setMode(next)
    setFormMessage('')
    setNotice(null)
  }

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

  const submitReset = async (event: React.FormEvent) => {
    event.preventDefault()
    setNotice(null)
    setPending(true)
    try {
      await requestPasswordReset(email)
      setNotice({
        tone: 'success',
        text: `If an account exists for ${email.trim()}, a password reset link is on its way. Check your inbox and spam folder.`,
      })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not send the reset email.' })
    } finally {
      setPending(false)
    }
  }

  const submitRecovery = async (event: React.FormEvent) => {
    event.preventDefault()
    setNotice(null)
    if (password.length < 6) {
      setNotice({ tone: 'error', text: 'Password must be at least 6 characters.' })
      return
    }
    if (password !== confirmPassword) {
      setNotice({ tone: 'error', text: 'Passwords do not match.' })
      return
    }
    setPending(true)
    try {
      await updatePassword(password)
      if (typeof window !== 'undefined') window.history.replaceState(null, '', '/auth')
      await signOut()
      clearRecoveryMode()
      setPassword('')
      setConfirmPassword('')
      setMode('signin')
      setNotice({ tone: 'success', text: 'Password updated. Sign in with your new password.' })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not update your password.' })
    } finally {
      setPending(false)
    }
  }

  const cancelRecovery = async () => {
    if (typeof window !== 'undefined') window.history.replaceState(null, '', '/auth')
    await signOut()
    clearRecoveryMode()
    setPassword('')
    setConfirmPassword('')
    setMode('signin')
    setNotice(null)
  }

  const loading = authStatus === 'loading'

  const heading =
    screen === 'recovery'
      ? 'Set a new password'
      : screen === 'reset'
        ? 'Reset your password'
        : screen === 'signup'
          ? 'Create your workspace'
          : 'Welcome back'

  const subheading =
    screen === 'recovery'
      ? 'Choose a strong new password for your account.'
      : screen === 'reset'
        ? "Enter your email and we'll send you a secure reset link."
        : screen === 'signup'
          ? 'Upload a CV, match live roles, and track every application.'
          : 'Sign in to pick up your matches and applications.'

  const headingIcon =
    screen === 'recovery' || screen === 'reset' ? (
      <LockKeyhole size={18} />
    ) : screen === 'signup' ? (
      <UserPlus size={18} />
    ) : (
      <LogIn size={18} />
    )

  return (
    <main className="grid min-h-screen bg-bg text-ink lg:grid-cols-[1.05fr_0.95fr]">
      {/* ===== Brand / showcase panel ===== */}
      <section className="relative hidden overflow-hidden bg-[#0b0e17] lg:block">
        <AuroraBackground />
        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <NavLink className="inline-flex w-fit items-center gap-3" to="/">
            <BrandLogo onDark />
          </NavLink>

          <div className="max-w-lg">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3.5 py-1.5 text-sm font-medium text-success">
              <ShieldCheck size={16} />
              User-owned data through Supabase Auth
            </div>
            <h1 className="text-4xl font-extrabold leading-tight text-white xl:text-5xl">
              Your CV, jobs, and tracker <span className="gradient-text animate-gradient-x">belong to you</span>.
            </h1>

            {/* auto-rotating highlight */}
            <div className="relative mt-10 h-28">
              <AnimatePresence mode="wait">
                {AUTH_HIGHLIGHTS.map((item, i) =>
                  i === highlight ? (
                    <motion.div
                      key={item.title}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-0 flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                        <item.icon size={22} />
                      </div>
                      <div>
                        <p className="text-base font-bold text-white">{item.title}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-300">{item.text}</p>
                      </div>
                    </motion.div>
                  ) : null,
                )}
              </AnimatePresence>
            </div>

            <div className="mt-6 flex gap-2">
              {AUTH_HIGHLIGHTS.map((item, i) => (
                <button
                  key={item.title}
                  aria-label={`Show ${item.title}`}
                  onClick={() => setHighlight(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === highlight ? 'w-8 bg-primary' : 'w-2.5 bg-white/25 hover:bg-white/40'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-10">
            {AUTH_STATS.map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl font-extrabold text-white">{stat.value}</p>
                <p className="text-xs uppercase tracking-widest text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Form panel ===== */}
      <section className="relative flex items-center justify-center overflow-hidden px-5 py-10">
        <div className="absolute right-5 top-5 z-10">
          <ThemeToggle />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          {screen === 'recovery' ? (
            <div className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted">
              <LockKeyhole size={15} /> Password recovery
            </div>
          ) : (
            <NavLink
              className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-ink"
              to="/"
            >
              <ChevronRight size={15} className="rotate-180" /> Back to home
            </NavLink>
          )}

          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <NavLink to="/">
              <BrandLogo />
            </NavLink>
          </div>

          <div className="glass rounded-3xl p-7 shadow-soft">
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">{headingIcon}</span>
              <h2 className="text-xl font-extrabold tracking-tight text-ink">{heading}</h2>
            </div>
            <p className="mb-6 text-sm text-muted">{subheading}</p>

            {/* animated segmented toggle (only for sign in / sign up) */}
            {screen === 'signin' || screen === 'signup' ? (
              <div className="relative mb-6 grid grid-cols-2 rounded-xl border border-line bg-bg/70 p-1">
                {(['signin', 'signup'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="relative z-10 h-10 rounded-lg text-sm font-semibold transition-colors"
                    onClick={() => switchMode(item)}
                  >
                    {mode === item ? (
                      <motion.span
                        layoutId="authToggleIndicator"
                        className="absolute inset-0 -z-10 rounded-lg bg-primary shadow-glow"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    ) : null}
                    <span className={mode === item ? 'text-white' : 'text-muted'}>
                      {item === 'signin' ? 'Sign in' : 'Sign up'}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            {/* ===== Reset request form ===== */}
            {screen === 'reset' ? (
              <form className="space-y-4" onSubmit={submitReset}>
                <label className="field-label block">
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
                <button className="primary-button h-12 w-full rounded-xl text-sm" disabled={pending}>
                  {pending ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" /> Sending…
                    </>
                  ) : (
                    <>
                      <Mail size={16} /> Send reset link
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="flex w-full items-center justify-center gap-1.5 text-sm font-semibold text-muted transition hover:text-ink"
                >
                  <ChevronRight size={15} className="rotate-180" /> Back to sign in
                </button>
              </form>
            ) : null}

            {/* ===== Set-new-password (recovery) form ===== */}
            {screen === 'recovery' ? (
              <form className="space-y-4" onSubmit={submitRecovery}>
                <label className="field-label block">
                  New password
                  <span className="field-shell normal-case">
                    <KeyRound size={16} className="text-muted" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      minLength={6}
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Minimum 6 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="shrink-0 text-muted transition hover:text-ink"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </span>
                </label>

                {password ? (
                  <div>
                    <div className="flex gap-1.5 pt-0.5">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <span
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                            i < passwordStrength
                              ? passwordStrength >= 3
                                ? 'bg-success'
                                : passwordStrength === 2
                                  ? 'bg-warning'
                                  : 'bg-danger'
                              : 'bg-line'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-muted">Password strength: {strengthMeta[passwordStrength]}</p>
                  </div>
                ) : null}

                <label className="field-label block">
                  Confirm new password
                  <span className="field-shell normal-case">
                    <KeyRound size={16} className="text-muted" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      minLength={6}
                      required
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Re-enter your new password"
                    />
                  </span>
                </label>

                <button className="primary-button h-12 w-full rounded-xl text-sm" disabled={pending}>
                  {pending ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" /> Updating…
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={16} /> Update password
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void cancelRecovery()}
                  className="flex w-full items-center justify-center gap-1.5 text-sm font-semibold text-muted transition hover:text-ink"
                >
                  Cancel
                </button>
              </form>
            ) : null}

            {/* ===== Sign in / Sign up form ===== */}
            {screen === 'signin' || screen === 'signup' ? (
              <form className="space-y-4" onSubmit={submit}>
                <AnimatePresence initial={false}>
                  {mode === 'signup' ? (
                    <motion.label
                      key="name-field"
                      className="field-label block"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      Name
                      <span className="field-shell normal-case">
                        <UserRound size={16} className="text-muted" />
                        <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
                      </span>
                    </motion.label>
                  ) : null}
                </AnimatePresence>

                <label className="field-label block">
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

                <label className="field-label block">
                  <span className="flex items-center justify-between">
                    Password
                    {mode === 'signin' ? (
                      <button
                        type="button"
                        onClick={() => switchMode('reset')}
                        className="text-xs font-semibold normal-case text-primary transition hover:underline"
                      >
                        Forgot password?
                      </button>
                    ) : null}
                  </span>
                  <span className="field-shell normal-case">
                    <KeyRound size={16} className="text-muted" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      minLength={6}
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Minimum 6 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="shrink-0 text-muted transition hover:text-ink"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </span>
                </label>

                <AnimatePresence initial={false}>
                  {mode === 'signup' && password ? (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex gap-1.5 pt-0.5">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <span
                            key={i}
                            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                              i < passwordStrength
                                ? passwordStrength >= 3
                                  ? 'bg-success'
                                  : passwordStrength === 2
                                    ? 'bg-warning'
                                    : 'bg-danger'
                                : 'bg-line'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="mt-1.5 text-xs text-muted">Password strength: {strengthMeta[passwordStrength]}</p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <button className="primary-button h-12 w-full rounded-xl text-sm" disabled={loading}>
                  {loading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" /> Please wait…
                    </>
                  ) : mode === 'signup' ? (
                    <>
                      <UserPlus size={16} /> Create account
                    </>
                  ) : (
                    <>
                      <LogIn size={16} /> Sign in
                    </>
                  )}
                </button>
              </form>
            ) : null}

            {/* ===== Messages ===== */}
            {screen === 'reset' || screen === 'recovery'
              ? notice
                ? [notice].map((item) => (
                    <motion.p
                      key={item.text}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm ${
                        item.tone === 'error'
                          ? 'border-danger/30 bg-danger/10 text-danger'
                          : 'border-success/30 bg-success/10 text-success'
                      }`}
                    >
                      {item.tone === 'error' ? (
                        <X size={15} className="mt-0.5 shrink-0" />
                      ) : (
                        <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
                      )}
                      {item.text}
                    </motion.p>
                  ))
                : null
              : [formMessage, authMessage].filter(Boolean).map((message) => (
                  <motion.p
                    key={message}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm ${
                      authStatus === 'error'
                        ? 'border-danger/30 bg-danger/10 text-danger'
                        : 'border-success/30 bg-success/10 text-success'
                    }`}
                  >
                    {authStatus === 'error' ? <X size={15} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={15} className="mt-0.5 shrink-0" />}
                    {message}
                  </motion.p>
                ))}

            <div className="mt-6 flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-line" />
              <span className="inline-flex items-center gap-1.5">
                <Lock size={12} /> Secured by Supabase Auth
              </span>
              <span className="h-px flex-1 bg-line" />
            </div>

            <p className="mt-5 text-center text-xs leading-5 text-muted">
              {screen === 'signup' ? (
                <>By creating an account you agree to keep this workspace for personal job-search use.</>
              ) : screen === 'signin' ? (
                <>
                  New here?{' '}
                  <button type="button" onClick={() => switchMode('signup')} className="font-semibold text-primary hover:underline">
                    Create an account
                  </button>
                </>
              ) : screen === 'reset' ? (
                <>Remembered it? Use “Back to sign in” above.</>
              ) : (
                <>This link is single-use and expires shortly after it is sent.</>
              )}
            </p>
          </div>
        </motion.div>
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
    const rankedCvSkills = [...activeCv.skills]
      .sort((a, b) => (b.skillRank || 0) - (a.skillRank || 0))
      .map((skill) => skill.skillName)
      .filter(Boolean)
      .slice(0, 20)
    const skills = profileSearchSkills(profile, rankedCvSkills).slice(0, 30)
    if (!skills.length) {
      setStatus('error')
      setMessage('Complete your profile skills or upload a CV before live job search.')
      return
    }

    const targetRoles = usefulPreferenceTerms(profile.targetRoles).length ? usefulPreferenceTerms(profile.targetRoles) : [profile.targetRole]
    const query = targetRoles[0] || skills.slice(0, 3).join(' ')
    const experienceYears = Math.max(Number(profile.experienceYears) || 0, Number(activeCv.totalYearsExperience) || 0)
    const params = new URLSearchParams({
      query,
      location: profileSearchLocation(profile),
      skills: skills.join(','),
      targetRoles: targetRoles.join(','),
      mustHaveSkills: usefulPreferenceTerms(profile.mustHaveSkills).join(','),
      avoidKeywords: usefulPreferenceTerms(profile.avoidKeywords).join(','),
      preferredCountries: usefulPreferenceTerms(profile.preferredCountries).join(','),
      preferredCities: usefulPreferenceTerms(profile.preferredCities).join(','),
      remotePreference: normaliseRemotePreference(profile.remotePreference),
      minimumSalary: String(profile.minimumSalary || profile.salaryMin || 0),
      experienceYears: String(experienceYears),
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

const remotePreferenceOptions: Array<{ value: RemotePreference; label: string; detail: string }> = [
  { value: 'remote', label: 'Remote', detail: 'Only remote-first roles.' },
  { value: 'hybrid', label: 'Hybrid', detail: 'Remote or hybrid roles.' },
  { value: 'onsite', label: 'On-site', detail: 'Location-matched office roles.' },
  { value: 'any', label: 'Any', detail: 'Keep all work modes open.' },
]

function ProfilePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const profile = useJobmatchStore((state) => state.profile)
  const updateProfile = useJobmatchStore((state) => state.updateProfile)
  const from = (location.state as { from?: string } | null)?.from
  const [targetRoles, setTargetRoles] = useState(joinPreferenceText(profile.targetRoles))
  const [mustHaveSkills, setMustHaveSkills] = useState(joinPreferenceText(profile.mustHaveSkills))
  const [avoidKeywords, setAvoidKeywords] = useState(joinPreferenceText(profile.avoidKeywords))
  const [preferredCountries, setPreferredCountries] = useState(profile.preferredCountries.length ? profile.preferredCountries : ['Remote'])
  const [preferredCities, setPreferredCities] = useState(profile.preferredCities.length ? profile.preferredCities : ['Remote'])
  const [selectedCountry, setSelectedCountry] = useState(preferredCountries[0] || 'Remote')
  const [selectedCity, setSelectedCity] = useState(preferredCities[0] || 'Remote')
  const [remotePreference, setRemotePreference] = useState<RemotePreference>(normaliseRemotePreference(profile.remotePreference))
  const [minimumSalary, setMinimumSalary] = useState(profile.minimumSalary || profile.salaryMin || 0)
  const [experienceYears, setExperienceYears] = useState(profile.experienceYears || 0)
  const [goodJobExamples, setGoodJobExamples] = useState(joinPreferenceText(profile.goodJobExamples))
  const [badJobExamples, setBadJobExamples] = useState(joinPreferenceText(profile.badJobExamples))
  const [isMarkedComplete, setIsMarkedComplete] = useState(Boolean(profile.profileCompletedAt))
  const [message, setMessage] = useState('')
  const selectedCities = getCitiesForCountry(selectedCountry)
  const completion = getProfileCompletion(profile)

  useEffect(() => {
    setTargetRoles(joinPreferenceText(profile.targetRoles))
    setMustHaveSkills(joinPreferenceText(profile.mustHaveSkills))
    setAvoidKeywords(joinPreferenceText(profile.avoidKeywords))
    setPreferredCountries(profile.preferredCountries.length ? profile.preferredCountries : ['Remote'])
    setPreferredCities(profile.preferredCities.length ? profile.preferredCities : ['Remote'])
    setRemotePreference(normaliseRemotePreference(profile.remotePreference))
    setMinimumSalary(profile.minimumSalary || profile.salaryMin || 0)
    setExperienceYears(profile.experienceYears || 0)
    setGoodJobExamples(joinPreferenceText(profile.goodJobExamples))
    setBadJobExamples(joinPreferenceText(profile.badJobExamples))
    setIsMarkedComplete(Boolean(profile.profileCompletedAt))
  }, [profile])

  useEffect(() => {
    setSelectedCity(getCitiesForCountry(selectedCountry)[0] || 'Any city')
  }, [selectedCountry])

  const addPreferredLocation = () => {
    const country = selectedCountry || 'Remote'
    const city = country === 'Remote' ? 'Remote' : selectedCity || 'Any city'
    if (country === 'Remote') {
      setPreferredCountries(['Remote'])
      setPreferredCities(['Remote'])
      return
    }

    const next = [...preferredLocationPairs(preferredCountries, preferredCities), { country, city }]
      .filter((place) => place.country !== 'Remote')
      .filter((place, index, list) => list.findIndex((item) => item.country === place.country && item.city === place.city) === index)
      .slice(0, 8)
    setPreferredCountries(next.map((place) => place.country))
    setPreferredCities(next.map((place) => place.city))
  }

  const removePreferredLocation = (index: number) => {
    const next = preferredLocationPairs(preferredCountries, preferredCities).filter((_, placeIndex) => placeIndex !== index)
    setPreferredCountries(next.length ? next.map((place) => place.country) : ['Remote'])
    setPreferredCities(next.length ? next.map((place) => place.city) : ['Remote'])
  }

  const buildPatch = (completedAt: string | null): Partial<UserProfile> => {
    const nextTargetRoles = splitPreferenceText(targetRoles, 10)
    const nextMustHaveSkills = splitPreferenceText(mustHaveSkills, 30)
    const nextAvoidKeywords = splitPreferenceText(avoidKeywords, 30)
    const nextGoodExamples = splitPreferenceText(goodJobExamples, 12)
    const nextBadExamples = splitPreferenceText(badJobExamples, 12)
    const salary = Math.max(0, Math.round(Number(minimumSalary) || 0))
    const years = clampExperienceYears(experienceYears)
    const pairs = preferredLocationPairs(preferredCountries, preferredCities)
    const primaryLocation = pairs[0] ? formatLocationPair(pairs[0]) : 'Remote'

    return {
      targetRole: nextTargetRoles[0] || '',
      targetRoles: nextTargetRoles,
      mustHaveSkills: nextMustHaveSkills,
      avoidKeywords: nextAvoidKeywords,
      preferredCountries,
      preferredCities,
      location: primaryLocation,
      remotePreference,
      preferredRemote: remotePreference === 'remote' || remotePreference === 'any',
      minimumSalary: salary,
      salaryMin: salary,
      salaryMax: Math.max(Number(profile.salaryMax) || 0, salary),
      experienceYears: years,
      goodJobExamples: nextGoodExamples,
      badJobExamples: nextBadExamples,
      profileCompletedAt: completedAt,
    }
  }

  const saveProfile = () => {
    const completedAt = isMarkedComplete ? profile.profileCompletedAt || new Date().toISOString() : null
    const patch = buildPatch(completedAt)
    const nextProfile = { ...profile, ...patch }
    const nextCompletion = getProfileCompletion(nextProfile)

    updateProfile(patch)
    setMessage(
      nextCompletion.isComplete
        ? 'Profile saved. Any filled profile fields will guide search; empty fields will fall back to your CV.'
        : 'Profile saved. Check the completed box when you want to unlock the workspace.',
    )
    if (nextCompletion.isComplete && from && from !== '/profile') {
      setTimeout(() => navigate(from, { replace: true }), 150)
    }
  }

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="grid gap-5 bg-gradient-to-br from-primary/18 via-panel to-panel p-5 lg:grid-cols-[1fr_360px] lg:p-6">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
              <Target size={16} />
              Matching profile
            </div>
            <h2 className="text-2xl font-bold text-ink md:text-3xl">Profile</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Fill only what you want. Checked completion unlocks the workspace; empty fields fall back to your uploaded CV.
            </p>
          </div>
          <div className="rounded-md border border-line bg-bg/65 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">{completion.isComplete ? 'Ready for live search' : 'Profile required'}</p>
              <span className={`rounded-md px-2 py-1 text-xs font-semibold ${completion.isComplete ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>
                {completion.isComplete ? 'Complete' : 'Checkbox needed'}
              </span>
            </div>
            {completion.isComplete ? (
              <p className="mt-3 text-sm leading-6 text-muted">
                Search uses profile fields when present, then falls back to resume skills.
              </p>
            ) : (
              <p className="mt-3 text-sm leading-6 text-muted">
                Check the completion box below and save. The fields themselves are optional.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="panel p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/15 text-primary">
              <BriefcaseBusiness size={21} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-ink">Role and skill target</h2>
              <p className="text-sm text-muted">These fields decide what live jobs are allowed into your feed.</p>
            </div>
          </div>
          <div className="grid gap-4">
            <label className="field-label">
              Target roles
              <textarea
                className="control mt-2 min-h-[84px] w-full rounded-md p-3 text-sm normal-case"
                value={targetRoles}
                onChange={(event) => setTargetRoles(event.target.value)}
                placeholder="Frontend Engineer, React Developer, Full Stack Engineer"
              />
            </label>
            <label className="field-label">
              Must-have skills
              <textarea
                className="control mt-2 min-h-[96px] w-full rounded-md p-3 text-sm normal-case"
                value={mustHaveSkills}
                onChange={(event) => setMustHaveSkills(event.target.value)}
                placeholder="React, TypeScript, Node.js, REST APIs"
              />
            </label>
            <label className="field-label">
              Avoid roles or keywords
              <textarea
                className="control mt-2 min-h-[84px] w-full rounded-md p-3 text-sm normal-case"
                value={avoidKeywords}
                onChange={(event) => setAvoidKeywords(event.target.value)}
                placeholder="Data entry, virtual assistant, sales, recruiter"
              />
            </label>
          </div>
        </div>

        <div className="panel p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-success/15 text-success">
              <MapPin size={21} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-ink">Location and package</h2>
              <p className="text-sm text-muted">Location and salary filters are applied before match scoring.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field-label">
              Country
              <PrettySelect
                className="mt-2 normal-case"
                value={selectedCountry}
                options={countryCityOptions.map((option) => ({ value: option.country, label: option.country }))}
                onChange={setSelectedCountry}
                ariaLabel="Preferred country"
                icon={<Globe2 size={16} />}
              />
            </label>
            <label className="field-label">
              City
              <PrettySelect
                className="mt-2 normal-case"
                value={selectedCity}
                options={selectedCities.map((city) => ({ value: city, label: city }))}
                onChange={setSelectedCity}
                ariaLabel="Preferred city"
                icon={<MapPin size={16} />}
              />
            </label>
            <button type="button" className="secondary-button sm:col-span-2" onClick={addPreferredLocation}>
              <Plus size={16} />
              Add location
            </button>
            <div className="sm:col-span-2">
              <div className="flex flex-wrap gap-2">
                {preferredLocationPairs(preferredCountries, preferredCities).map((place, index) => (
                  <span key={`${place.country}-${place.city}-${index}`} className="inline-flex items-center gap-2 rounded-md border border-line bg-bg/70 px-3 py-2 text-sm text-ink">
                    {formatLocationPair(place)}
                    <button
                      type="button"
                      className="text-muted transition hover:text-danger"
                      onClick={() => removePreferredLocation(index)}
                      aria-label={`Remove ${formatLocationPair(place)}`}
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <label className="field-label">
              Remote preference
              <PrettySelect<RemotePreference>
                className="mt-2 normal-case"
                value={remotePreference}
                options={remotePreferenceOptions}
                onChange={setRemotePreference}
                ariaLabel="Remote preference"
                icon={<Radio size={16} />}
              />
            </label>
            <label className="field-label">
              Minimum salary
              <span className="field-shell normal-case">
                <span className="text-sm font-bold text-muted">$</span>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={minimumSalary}
                  onChange={(event) => setMinimumSalary(Math.max(0, Number(event.target.value) || 0))}
                  placeholder="60000"
                />
              </span>
            </label>
            <label className="field-label sm:col-span-2">
              Experience years
              <span className="field-shell normal-case">
                <Gauge size={16} className="text-muted" />
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
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-warning/15 text-warning">
            <CheckCircle2 size={21} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-ink">Examples</h2>
            <p className="text-sm text-muted">Good and bad examples sharpen the final relevance filter.</p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="field-label">
            Good job examples
            <textarea
              className="control mt-2 min-h-[110px] w-full rounded-md p-3 text-sm normal-case"
              value={goodJobExamples}
              onChange={(event) => setGoodJobExamples(event.target.value)}
              placeholder="Senior React Engineer at SaaS company, Frontend Platform Engineer"
            />
          </label>
          <label className="field-label">
            Bad job examples
            <textarea
              className="control mt-2 min-h-[110px] w-full rounded-md p-3 text-sm normal-case"
              value={badJobExamples}
              onChange={(event) => setBadJobExamples(event.target.value)}
              placeholder="Data Entry Assistant, Sales Representative, Recruiter"
            />
          </label>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label className="flex min-h-11 items-center gap-3 rounded-md border border-line bg-bg/70 px-3 text-sm font-semibold text-ink transition hover:border-primary/60">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={isMarkedComplete}
              onChange={(event) => setIsMarkedComplete(event.target.checked)}
            />
            Profile is completed
          </label>
          <button type="button" className="primary-button h-11" onClick={saveProfile}>
            <Save size={16} />
            Save profile
          </button>
          {message ? (
            <p className={`text-sm ${isMarkedComplete ? 'text-success' : 'text-warning'}`}>
              {message}
            </p>
          ) : null}
        </div>
      </section>

      <AccountSecurityCard />
    </div>
  )
}

function AccountSecurityCard() {
  const updatePassword = useJobmatchStore((state) => state.updatePassword)
  const email = useJobmatchStore((state) => state.profile.email)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)

  const strength = useMemo(() => {
    let score = 0
    if (newPassword.length >= 6) score += 1
    if (newPassword.length >= 10) score += 1
    if (/[0-9]/.test(newPassword)) score += 1
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 1
    return score
  }, [newPassword])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setNotice(null)

    if (newPassword.length < 6) {
      setNotice({ tone: 'error', text: 'New password must be at least 6 characters.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setNotice({ tone: 'error', text: 'New passwords do not match.' })
      return
    }
    if (currentPassword && currentPassword === newPassword) {
      setNotice({ tone: 'error', text: 'New password must be different from your current password.' })
      return
    }

    setPending(true)
    try {
      await updatePassword(newPassword, currentPassword || undefined)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setNotice({ tone: 'success', text: 'Password updated successfully.' })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not update your password.' })
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="panel p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/15 text-primary">
            <ShieldCheck size={21} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-ink">Account security</h2>
            <p className="text-sm text-muted">
              Change the password for {email ? <span className="font-medium text-ink">{email}</span> : 'your account'}.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowPasswords((current) => !current)}
          className="secondary-button h-9 px-3 text-xs"
        >
          {showPasswords ? <EyeOff size={15} /> : <Eye size={15} />}
          {showPasswords ? 'Hide' : 'Show'}
        </button>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="field-label">
            Current password
            <span className="field-shell normal-case">
              <LockKeyhole size={16} className="text-muted" />
              <input
                type={showPasswords ? 'text' : 'password'}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Current password"
              />
            </span>
          </label>
          <label className="field-label">
            New password
            <span className="field-shell normal-case">
              <KeyRound size={16} className="text-muted" />
              <input
                type={showPasswords ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={6}
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Minimum 6 characters"
              />
            </span>
          </label>
          <label className="field-label">
            Confirm new password
            <span className="field-shell normal-case">
              <KeyRound size={16} className="text-muted" />
              <input
                type={showPasswords ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={6}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter new password"
              />
            </span>
          </label>
        </div>

        {newPassword ? (
          <div className="max-w-sm">
            <div className="flex gap-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                    i < strength
                      ? strength >= 3
                        ? 'bg-success'
                        : strength === 2
                          ? 'bg-warning'
                          : 'bg-danger'
                      : 'bg-line'
                  }`}
                />
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted">
              Password strength: {['Too short', 'Weak', 'Fair', 'Good', 'Strong'][strength]}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="primary-button h-11" disabled={pending}>
            {pending ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            {pending ? 'Updating…' : 'Update password'}
          </button>
          <p className="inline-flex items-center gap-1.5 text-xs text-muted">
            <ShieldCheck size={13} className="text-success" /> Verified against your current password before changing.
          </p>
        </div>

        {notice ? (
          <p
            className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
              notice.tone === 'error'
                ? 'border-danger/30 bg-danger/10 text-danger'
                : 'border-success/30 bg-success/10 text-success'
            }`}
          >
            {notice.tone === 'error' ? <X size={15} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={15} className="mt-0.5 shrink-0" />}
            {notice.text}
          </p>
        ) : null}
      </form>
    </section>
  )
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
            Targeting {(profile.targetRoles?.[0] || profile.targetRole)} roles from {profileSearchLocation(profile)}, with {profile.remotePreference} preference.
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
    const nextTargetRole = targetRole.trim() || profile.targetRole
    updateProfile({
      targetRole: nextTargetRole,
      targetRoles: [nextTargetRole],
      location: selectedLocation,
      preferredCountries: [selectedCountry],
      preferredCities: [selectedCity],
      remotePreference: preferredRemote ? 'remote' : 'onsite',
      preferredRemote,
      experienceYears: nextExperienceYears,
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
              text={`${profile.remotePreference} in ${profileSearchLocation(profile)}, salary from ${formatCurrency(profile.minimumSalary || profile.salaryMin)}.`}
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
                <PrettySelect
                  className="mt-2 normal-case"
                  value={selectedCountry}
                  options={countryCityOptions.map((option) => ({ value: option.country, label: option.country }))}
                  onChange={(country) => {
                    setSelectedCountry(country)
                    setSelectedCity(getCitiesForCountry(country)[0] || '')
                  }}
                  ariaLabel="Country"
                  icon={<Globe2 size={16} />}
                />
              </label>
              <label className="field-label">
                City
                <PrettySelect
                  className="mt-2 normal-case"
                  value={selectedCity}
                  options={selectedCities.map((city) => ({ value: city, label: city }))}
                  onChange={setSelectedCity}
                  ariaLabel="City"
                  icon={<MapPin size={16} />}
                />
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

function preferredLocationPairs(countries: string[], cities: string[]) {
  const length = Math.max(countries.length, cities.length)
  return Array.from({ length }, (_, index) => ({
    country: countries[index] || countries[0] || 'Remote',
    city: cities[index] || cities[0] || 'Remote',
  })).filter((place) => place.country && place.city)
}

function formatLocationPair(place: { country: string; city: string }) {
  return formatSelectedLocation(place.country, place.city)
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

const skillTypeSelectOptions = skillTypeOptions.map((option) => ({
  value: option,
  label: option.charAt(0).toUpperCase() + option.slice(1),
}))

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
          <PrettySelect<CvSkill['skillType']>
            className="mt-2 normal-case"
            value={newType}
            options={skillTypeSelectOptions}
            onChange={setNewType}
            ariaLabel="Skill type"
          />
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
                <PrettySelect<CvSkill['skillType']>
                  className="mt-2 normal-case"
                  value={draftType}
                  options={skillTypeSelectOptions}
                  onChange={setDraftType}
                  ariaLabel={`${skill.skillName} skill type`}
                />
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
