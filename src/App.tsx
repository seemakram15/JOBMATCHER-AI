import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Bell,
  BellRing,
  Briefcase,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Compass,
  Cpu,
  Crown,
  DatabaseZap,
  Eye,
  EyeOff,
  FileText,
  Gauge,
  Globe2,
  Inbox,
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
  Plus,
  RefreshCw,
  Rocket,
  Save,
  ScanSearch,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  Target,
  Trash2,
  TrendingUp,
  UploadCloud,
  Wand2,
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
import { TagInput } from './components/ui/TagInput'
import { SkillsBoard } from './components/SkillsBoard'
import { AdminConsole } from './components/admin/AdminConsole'
import { ImpersonationBanner } from './components/admin/ImpersonationBanner'
import {
  getProfileCompletion,
  isProfileComplete,
  normaliseRemotePreference,
  profileSearchLocation,
  profileSearchSkills,
  usefulPreferenceTerms,
} from './lib/profilePreferences'
import { filterAndSortJobs, scoreJobs } from './lib/scoring'
import { defaultFilters } from './lib/defaults'
import { recordSearch } from './lib/workspacePersistence'
import { requireSupabase } from './lib/supabase'
import { useJobmatchStore } from './store/useJobmatchStore'
import type {
  Application,
  ApplicationStatus,
  CvProfile,
  CvSkill,
  ExperienceLevel,
  Job,
  JobFilters,
  JobType,
  LiveJobSourceResult,
  ParsedCvPayload,
  RemotePreference,
  ScoredJob,
  UserProfile,
  UserRole,
  WorkMode,
} from './types'

type Accent = 'primary' | 'cyan' | 'success' | 'warning' | 'violet' | 'pink' | 'danger' | 'muted'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  accent: Accent
  adminOnly: boolean
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, accent: 'primary', adminOnly: false },
  { to: '/jobs', label: 'Find Jobs', icon: Compass, accent: 'cyan', adminOnly: false },
  { to: '/cv', label: 'My CV', icon: FileText, accent: 'success', adminOnly: false },
  { to: '/tracker', label: 'Applications', icon: ClipboardList, accent: 'warning', adminOnly: false },
  { to: '/profile', label: 'Preferences', icon: SlidersHorizontal, accent: 'violet', adminOnly: false },
  { to: '/alerts', label: 'Alerts', icon: BellRing, accent: 'pink', adminOnly: false },
  { to: '/admin', label: 'Admin', icon: ShieldCheck, accent: 'danger', adminOnly: true },
  { to: '/settings', label: 'Settings', icon: Settings, accent: 'muted', adminOnly: false },
]

// Static class maps (so Tailwind keeps them) for per-section accent coloring.
const ACCENT_SOFT: Record<Accent, string> = {
  primary: 'bg-primary/15 text-primary',
  cyan: 'bg-cyan/15 text-cyan',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  violet: 'bg-violet/15 text-violet',
  pink: 'bg-pink/15 text-pink',
  danger: 'bg-danger/15 text-danger',
  muted: 'bg-muted/15 text-muted',
}

const ACCENT_ACTIVE: Record<Accent, string> = {
  primary: 'bg-primary/15 text-primary',
  cyan: 'bg-cyan/15 text-cyan',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  violet: 'bg-violet/15 text-violet',
  pink: 'bg-pink/15 text-pink',
  danger: 'bg-danger/15 text-danger',
  muted: 'bg-muted/20 text-ink',
}

function isAdminRole(role: UserRole | string | undefined) {
  return role === 'admin' || role === 'superadmin'
}

const brandTagline = 'Upload. Match. Apply smarter.'

type ThemeMode = 'dark' | 'light'

/**
 * Returns the workspace data to display. When an admin is impersonating a user,
 * this returns that user's read-only snapshot; otherwise the signed-in user's
 * own live data. Page CONTENT reads from here; nav/role gating uses the real profile.
 */
function useWorkspaceView() {
  const impersonation = useJobmatchStore((state) => state.impersonation)
  const profile = useJobmatchStore((state) => state.profile)
  const cvs = useJobmatchStore((state) => state.cvs)
  const activeCv = useJobmatchStore((state) => state.activeCv)
  const jobs = useJobmatchStore((state) => state.jobs)
  const applications = useJobmatchStore((state) => state.applications)
  const notifications = useJobmatchStore((state) => state.notifications)

  if (impersonation) {
    const snap = impersonation.snapshot
    return {
      profile: snap.profile,
      cvs: snap.cvs,
      activeCv: snap.activeCv,
      jobs: snap.jobs,
      applications: snap.applications,
      notifications: snap.notifications,
      isImpersonating: true,
      readOnly: true,
    }
  }

  return { profile, cvs, activeCv, jobs, applications, notifications, isImpersonating: false, readOnly: false }
}

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

  // The auth screen stays mounted during its own loading (sign in / sign up),
  // so form state and confirmation messages survive — only show the boot frame
  // for the authenticated workspace loading.
  if (authStatus === 'loading' && !hasWorkspaceSnapshot && location.pathname !== '/auth') {
    return <WorkspaceBootFrame />
  }

  if (location.pathname === '/auth' || authStatus === 'unauthenticated' || authStatus === 'error') {
    return <AuthPage />
  }

  // Job seekers must finish their preferences first; admins/superadmins skip this.
  if (
    authStatus === 'authenticated' &&
    workspaceStatus !== 'loading' &&
    !isAdminRole(profile.role) &&
    !isProfileComplete(profile) &&
    location.pathname !== '/profile'
  ) {
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
        <Route path="/admin" element={isAdminRole(profile.role) ? <AdminPage /> : <Navigate to="/dashboard" replace />} />
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
        const result = await signUp(email.trim(), password, name.trim())
        if (result.confirmationRequired) {
          setMode('signin')
          setFormMessage(`Account created! We emailed a confirmation link to ${email.trim()}. Click it to activate your account, then sign in.`)
        } else {
          setFormMessage('Account created. Signing you in now.')
        }
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

function RoleBadge({ role }: { role: UserRole }) {
  if (role === 'superadmin') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-violet/40 bg-violet/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet">
        <Crown size={10} /> Superadmin
      </span>
    )
  }
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
        <ShieldCheck size={10} /> Admin
      </span>
    )
  }
  return <span className="text-xs text-muted">Member</span>
}

function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const profile = useJobmatchStore((state) => state.profile)
  const notifications = useJobmatchStore((state) => state.notifications)
  const signOut = useJobmatchStore((state) => state.signOut)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const unread = notifications.filter((notification) => !notification.isRead).length
  const current = navItems.find((item) => item.to === location.pathname)
  const pageLabel = current?.label ?? 'Dashboard'
  const accent = current?.accent ?? 'primary'
  const PageIcon = current?.icon ?? LayoutDashboard

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
      <div className="grid min-h-screen lg:grid-cols-[264px_1fr]">
        <aside className="hidden border-r border-line bg-panel/70 p-4 lg:block">
          <WorkspaceNav />
        </aside>

        <div className="min-w-0">
          <ImpersonationBanner />
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-bg/85 px-4 backdrop-blur md:px-6">
            <div className="flex items-center gap-3">
              <button className="icon-button lg:hidden" aria-label="Open navigation" title="Navigation" onClick={() => setMobileNavOpen(true)}>
                <Menu size={18} />
              </button>
              <span className={`hidden h-9 w-9 items-center justify-center rounded-xl sm:flex ${ACCENT_SOFT[accent]}`}>
                <PageIcon size={18} />
              </span>
              <div>
                <p className="text-xs font-medium text-muted">{brandTagline}</p>
                <h1 className="text-lg font-semibold text-ink">{pageLabel}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <ThemeToggle />
              <NavLink className="icon-button relative" to="/alerts" aria-label={`${unread} unread alerts`} title="Alerts">
                <Bell size={17} />
                {unread ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                    {unread}
                  </span>
                ) : null}
              </NavLink>
              <div className="hidden items-center gap-3 rounded-xl border border-line bg-panel px-3 py-1.5 sm:flex">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <UserRound size={16} />
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-medium text-ink">{profile.name}</p>
                  <RoleBadge role={profile.role} />
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
                className="h-full w-full max-w-[300px] rounded-2xl border border-line bg-panel p-4 shadow-soft"
                onClick={(event) => event.stopPropagation()}
              >
                <WorkspaceNav />
              </aside>
            </div>
          ) : null}
          <main id="main-content" className="p-4 md:p-6">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
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
  const role = useJobmatchStore((state) => state.profile.role)
  const items = navItems.filter((item) => !item.adminOnly || isAdminRole(role))

  return (
    <div className="flex h-full flex-col">
      <div className="mb-7">
        <BrandLogo />
      </div>
      <nav className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? `${ACCENT_ACTIVE[item.accent]} shadow-sm` : 'text-muted hover:bg-bg/70 hover:text-ink'
                }`
              }
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${ACCENT_SOFT[item.accent]}`}>
                <Icon size={16} />
              </span>
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      <div className="mt-auto rounded-2xl border border-line bg-bg/60 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Sparkles size={16} className="text-violet" />
          Quick tip
        </div>
        <p className="mt-2 text-xs leading-5 text-muted">
          Upload a CV and set your preferences to unlock sharper, score-first job matches.
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
      const client = requireSupabase()
      const { data } = await client.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Please sign in again before running live job search.')

      const response = await fetch(`/api/live-jobs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = (await response.json()) as {
        jobs?: Job[]
        sources?: LiveJobSourceResult[]
        error?: { message: string }
      }

      if (!response.ok || !payload.jobs) {
        throw new Error(payload.error?.message || 'Live job extraction failed.')
      }

      setLiveJobs(payload.jobs, payload.sources || [])
      void recordSearch(query, payload.jobs.length).catch(() => undefined)
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
  const [targetRoles, setTargetRoles] = useState<string[]>(profile.targetRoles ?? [])
  const [mustHaveSkills, setMustHaveSkills] = useState<string[]>(profile.mustHaveSkills ?? [])
  const [avoidKeywords, setAvoidKeywords] = useState<string[]>(profile.avoidKeywords ?? [])
  const [preferredCountries, setPreferredCountries] = useState(profile.preferredCountries.length ? profile.preferredCountries : ['Remote'])
  const [preferredCities, setPreferredCities] = useState(profile.preferredCities.length ? profile.preferredCities : ['Remote'])
  const [selectedCountry, setSelectedCountry] = useState(preferredCountries[0] || 'Remote')
  const [selectedCity, setSelectedCity] = useState(preferredCities[0] || 'Remote')
  const [remotePreference, setRemotePreference] = useState<RemotePreference>(normaliseRemotePreference(profile.remotePreference))
  const [minimumSalary, setMinimumSalary] = useState(profile.minimumSalary || profile.salaryMin || 0)
  const [experienceYears, setExperienceYears] = useState(profile.experienceYears || 0)
  const [goodJobExamples, setGoodJobExamples] = useState<string[]>(profile.goodJobExamples ?? [])
  const [badJobExamples, setBadJobExamples] = useState<string[]>(profile.badJobExamples ?? [])
  const [isMarkedComplete, setIsMarkedComplete] = useState(Boolean(profile.profileCompletedAt))
  const [message, setMessage] = useState('')
  const selectedCities = getCitiesForCountry(selectedCountry)
  const completion = getProfileCompletion(profile)

  useEffect(() => {
    setTargetRoles(profile.targetRoles ?? [])
    setMustHaveSkills(profile.mustHaveSkills ?? [])
    setAvoidKeywords(profile.avoidKeywords ?? [])
    setPreferredCountries(profile.preferredCountries.length ? profile.preferredCountries : ['Remote'])
    setPreferredCities(profile.preferredCities.length ? profile.preferredCities : ['Remote'])
    setRemotePreference(normaliseRemotePreference(profile.remotePreference))
    setMinimumSalary(profile.minimumSalary || profile.salaryMin || 0)
    setExperienceYears(profile.experienceYears || 0)
    setGoodJobExamples(profile.goodJobExamples ?? [])
    setBadJobExamples(profile.badJobExamples ?? [])
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
    const nextTargetRoles = targetRoles.slice(0, 10)
    const nextMustHaveSkills = mustHaveSkills.slice(0, 30)
    const nextAvoidKeywords = avoidKeywords.slice(0, 30)
    const nextGoodExamples = goodJobExamples.slice(0, 12)
    const nextBadExamples = badJobExamples.slice(0, 12)
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

  const locationPairs = preferredLocationPairs(preferredCountries, preferredCities)

  return (
    <div className="space-y-6">
      <section className="panel relative overflow-hidden">
        <div className="grid gap-5 bg-gradient-to-br from-violet/18 via-panel to-panel p-5 lg:grid-cols-[1fr_360px] lg:p-6">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet/30 bg-violet/10 px-3 py-1.5 text-sm font-semibold text-violet">
              <SlidersHorizontal size={16} />
              Your job preferences
            </div>
            <h2 className="text-2xl font-bold text-ink md:text-3xl">Tell us what you want</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Add a few tags and we'll only surface jobs that fit. Anything you leave empty falls back to your uploaded CV.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-bg/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">{completion.isComplete ? 'Ready to search' : 'Almost there'}</p>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${completion.isComplete ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>
                {completion.isComplete ? 'Complete' : 'Action needed'}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted">
              {completion.isComplete
                ? 'We use your preferences first, then your resume skills to rank jobs.'
                : 'Tick “I’m done setting preferences” below and save to unlock the full workspace.'}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="panel p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet/15 text-violet">
              <Briefcase size={21} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-ink">What you're looking for</h2>
              <p className="text-sm text-muted">Type a tag and press Enter. These decide which jobs reach your feed.</p>
            </div>
          </div>
          <div className="grid gap-5">
            <div>
              <p className="field-label">Job titles you want</p>
              <TagInput value={targetRoles} onChange={setTargetRoles} accent="primary" max={10} icon={<Target size={15} />} placeholder="Frontend Engineer, React Developer…" ariaLabel="Target roles" />
            </div>
            <div>
              <p className="field-label">Must-have skills</p>
              <TagInput value={mustHaveSkills} onChange={setMustHaveSkills} accent="success" max={30} icon={<Sparkles size={15} />} placeholder="React, TypeScript, Node.js…" ariaLabel="Must-have skills" />
            </div>
            <div>
              <p className="field-label">Avoid these roles / keywords</p>
              <TagInput value={avoidKeywords} onChange={setAvoidKeywords} accent="danger" max={30} icon={<X size={15} />} placeholder="Data entry, sales, recruiter…" ariaLabel="Avoid keywords" />
            </div>
          </div>
        </div>

        <div className="panel p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan/15 text-cyan">
              <MapPin size={21} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-ink">Location &amp; salary</h2>
              <p className="text-sm text-muted">Where you'd work and your minimum pay.</p>
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
            {locationPairs.length ? (
              <div className="sm:col-span-2">
                <div className="flex flex-wrap gap-2">
                  {locationPairs.map((place, index) => (
                    <span key={`${place.country}-${place.city}-${index}`} className="inline-flex items-center gap-2 rounded-lg border border-cyan/30 bg-cyan/10 px-3 py-1.5 text-sm font-medium text-cyan">
                      <MapPin size={13} />
                      {formatLocationPair(place)}
                      <button
                        type="button"
                        className="opacity-70 transition hover:opacity-100"
                        onClick={() => removePreferredLocation(index)}
                        aria-label={`Remove ${formatLocationPair(place)}`}
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="field-label sm:col-span-2">
              Work style
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {remotePreferenceOptions.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => setRemotePreference(option.value)}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold capitalize transition ${
                      remotePreference === option.value
                        ? 'border-cyan bg-cyan/15 text-cyan'
                        : 'border-line bg-bg/60 text-muted hover:border-cyan/40 hover:text-ink'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field-label sm:col-span-2">
              Minimum salary (USD / year)
              <div className="mt-2 flex items-center gap-3">
                <span className="field-shell normal-case flex-1">
                  <Banknote size={16} className="text-success" />
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={minimumSalary}
                    onChange={(event) => setMinimumSalary(Math.max(0, Number(event.target.value) || 0))}
                    placeholder="60000"
                  />
                </span>
                <span className="w-24 shrink-0 text-right font-mono text-sm font-semibold text-ink">
                  {minimumSalary ? formatCurrency(minimumSalary) : 'Any'}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={300000}
                step={5000}
                value={Math.min(minimumSalary, 300000)}
                onChange={(event) => setMinimumSalary(Number(event.target.value))}
                className="skill-range mt-3 w-full"
                style={{ ['--rank' as string]: `${Math.min(minimumSalary, 300000) / 3000}%` }}
                aria-label="Minimum salary"
              />
            </div>

            <div className="field-label sm:col-span-2">
              Years of experience
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={40}
                  step={1}
                  value={Math.min(Number(experienceYears) || 0, 40)}
                  onChange={(event) => setExperienceYears(clampExperienceYears(event.target.value))}
                  className="skill-range flex-1"
                  style={{ ['--rank' as string]: `${(Math.min(Number(experienceYears) || 0, 40) / 40) * 100}%` }}
                  aria-label="Years of experience"
                />
                <span className="w-16 shrink-0 text-right font-mono text-sm font-semibold text-ink">{experienceYears} yrs</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning/15 text-warning">
            <CheckCircle2 size={21} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-ink">Example jobs <span className="text-sm font-normal text-muted">(optional)</span></h2>
            <p className="text-sm text-muted">A few real examples help us fine-tune what counts as a good match.</p>
          </div>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <p className="field-label flex items-center gap-1.5"><Check size={13} className="text-success" /> Jobs you'd love</p>
            <TagInput value={goodJobExamples} onChange={setGoodJobExamples} accent="success" max={12} placeholder="Senior React Engineer at a SaaS company…" ariaLabel="Good job examples" />
          </div>
          <div>
            <p className="field-label flex items-center gap-1.5"><X size={13} className="text-danger" /> Jobs to skip</p>
            <TagInput value={badJobExamples} onChange={setBadJobExamples} accent="danger" max={12} placeholder="Data Entry Assistant, Cold-call Sales…" ariaLabel="Bad job examples" />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line bg-bg/60 px-4 text-sm font-semibold text-ink transition hover:border-violet/60">
            <input
              type="checkbox"
              className="h-4 w-4 accent-violet"
              checked={isMarkedComplete}
              onChange={(event) => setIsMarkedComplete(event.target.checked)}
            />
            I'm done setting preferences
          </label>
          <button type="button" className="primary-button h-11 rounded-xl" onClick={saveProfile}>
            <Save size={16} />
            Save preferences
          </button>
          {message ? (
            <p className={`text-sm ${isMarkedComplete ? 'text-success' : 'text-warning'}`}>{message}</p>
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

const CHART = {
  grid: 'rgba(148,163,184,0.16)',
  axis: '#8E96AA',
  indigo: '#6366F1',
  emerald: '#10B981',
  tooltipBg: '#141A2A',
  tooltipBorder: '#2A3147',
}

function DashboardPage() {
  const view = useWorkspaceView()
  const { profile, activeCv, applications, jobs } = view
  const searchedJobsCount = useJobmatchStore((state) => state.searchedJobsCount)
  const lastLiveSearchAt = useJobmatchStore((state) => state.lastLiveSearchAt)

  const savedJobIds = useMemo(
    () => applications.filter((application) => application.status === 'saved').map((application) => application.jobId),
    [applications],
  )
  const scoredJobs = useMemo(
    () => scoreJobs(profile, activeCv, jobs, savedJobIds),
    [profile, activeCv, jobs, savedJobIds],
  )

  const liveMatches = view.isImpersonating ? jobs.length : Math.max(searchedJobsCount, jobs.length)
  const appliedCount = applications.filter((a) => a.status === 'applied').length
  const interviews = applications.filter((a) => a.status === 'interviewing').length
  const savedCount = applications.filter((a) => a.status === 'saved').length
  const averageScore = scoredJobs.length
    ? Math.round(scoredJobs.reduce((total, scoredJob) => total + scoredJob.match.totalScore, 0) / scoredJobs.length)
    : 0

  const activity = useMemo(
    () => buildActivity(applications, view.isImpersonating ? jobs.length : searchedJobsCount, lastLiveSearchAt),
    [applications, jobs.length, searchedJobsCount, lastLiveSearchAt, view.isImpersonating],
  )
  const skillDemand = useMemo(
    () => buildSkillDemand(scoredJobs, activeCv.skills.map((skill) => skill.skillCanonical)),
    [scoredJobs, activeCv.skills],
  )
  const funnel = ['saved', 'applied', 'interviewing', 'offer'].map((status) => ({
    status: status.replace('_', ' '),
    count: applications.filter((application) => application.status === status).length,
  }))

  const kpis = [
    { label: 'Live matches', value: liveMatches, suffix: '', icon: Compass, accent: 'primary' as Accent },
    { label: 'Applications sent', value: appliedCount, suffix: '', icon: ClipboardList, accent: 'success' as Accent },
    { label: 'Interviews', value: interviews, suffix: '', icon: CalendarDays, accent: 'warning' as Accent },
    { label: 'Average match', value: averageScore, suffix: '%', icon: Gauge, accent: 'violet' as Accent },
  ]

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon
          return (
            <Reveal key={kpi.label} delay={i * 0.05}>
              <div className="panel p-5">
                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${ACCENT_SOFT[kpi.accent]}`}>
                  <Icon size={20} />
                </div>
                <p className="text-3xl font-extrabold tracking-tight text-ink">
                  <CountUp to={kpi.value} suffix={kpi.suffix} />
                </p>
                <p className="mt-1 text-sm text-muted">{kpi.label}</p>
              </div>
            </Reveal>
          )
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Reveal className="flex">
          <div className="panel flex w-full flex-col p-5">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-ink">Your activity</h2>
                <p className="text-sm text-muted">Matches found and applications sent over the last 14 days.</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                <TrendingUp size={13} /> {savedCount} saved · avg {averageScore}%
              </span>
            </div>
            <div className="h-72 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activity} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke={CHART.axis} fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke={CHART.axis} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`, borderRadius: 12, color: '#E8EAF2' }}
                  />
                  <Line type="monotone" name="Matches" dataKey="jobsViewed" stroke={CHART.indigo} strokeWidth={3} dot={false} />
                  <Line type="monotone" name="Applied" dataKey="jobsApplied" stroke={CHART.emerald} strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.08} className="flex">
          <div className="panel flex w-full flex-col p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/15 text-success">
                <FileText size={17} />
              </span>
              <h2 className="text-lg font-semibold text-ink">Your active CV</h2>
            </div>
            <div className="mt-4 rounded-2xl border border-line bg-bg/50 p-4">
              <p className="truncate text-sm text-muted">{activeCv.label || 'No CV uploaded yet'}</p>
              <div className="mt-2 flex items-end gap-4">
                <div>
                  <p className="text-2xl font-bold text-ink">{activeCv.skills.length}</p>
                  <p className="text-xs text-muted">skills</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-ink">{activeCv.totalYearsExperience}</p>
                  <p className="text-xs text-muted">yrs experience</p>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2.5">
              {activeCv.skills.length ? (
                [...activeCv.skills]
                  .sort((a, b) => (b.skillRank || 0) - (a.skillRank || 0))
                  .slice(0, 5)
                  .map((skill) => (
                    <div key={skill.skillName}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="truncate text-ink">{skill.skillName}</span>
                        <span className="font-mono text-xs text-muted">{skill.skillRank || 0}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-line">
                        <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan" style={{ width: `${skill.skillRank || 0}%` }} />
                      </div>
                    </div>
                  ))
              ) : (
                <p className="text-sm leading-6 text-muted">Upload a CV in My CV to populate your skill signal.</p>
              )}
            </div>
            <p className="mt-auto pt-4 text-xs leading-5 text-muted">
              Targeting <span className="font-medium text-ink">{profile.targetRoles?.[0] || profile.targetRole || 'roles'}</span> from{' '}
              {profileSearchLocation(profile)}.
              {!view.isImpersonating && lastLiveSearchAt
                ? ` Last search ${formatDistanceToNowStrict(new Date(lastLiveSearchAt), { addSuffix: true })}.`
                : ''}
            </p>
          </div>
        </Reveal>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Reveal>
          <div className="panel p-5">
            <h2 className="text-lg font-semibold text-ink">Application stages</h2>
            <p className="text-sm text-muted">Where your applications sit right now.</p>
            <div className="mt-5 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnel} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="status" stroke={CHART.axis} fontSize={12} tickLine={false} axisLine={false} className="capitalize" />
                  <YAxis allowDecimals={false} stroke={CHART.axis} fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                    contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`, borderRadius: 12, color: '#E8EAF2' }}
                  />
                  <Bar dataKey="count" fill={CHART.indigo} radius={[8, 8, 0, 0]} maxBarSize={64} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="panel p-5">
            <h2 className="text-lg font-semibold text-ink">Skills employers want</h2>
            <p className="text-sm text-muted">In-demand skills from your matches — and which you already have.</p>
            <div className="mt-5 space-y-4">
              {skillDemand.length ? (
                skillDemand.map((skill) => (
                  <div key={skill.skill}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-ink">{skill.skill}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          skill.userHas ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
                        }`}
                      >
                        {skill.userHas ? 'You have' : 'Add this'}
                      </span>
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
                  Run a live search after uploading a CV to see which in-demand skills you have and which to add.
                </p>
              )}
            </div>
          </div>
        </Reveal>
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

const discoverySortOptions: { value: JobFilters['sort']; label: string }[] = [
  { value: 'score', label: 'Best match' },
  { value: 'date', label: 'Newest' },
  { value: 'salary', label: 'Salary' },
  { value: 'company', label: 'Company' },
]

function JobDiscoveryPage() {
  const scoredJobs = useScoredJobs()
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
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filteredJobs = useMemo(() => filterAndSortJobs(scoredJobs, filters), [scoredJobs, filters])
  const selected = filteredJobs.find(({ job }) => job.id === selectedJobId) ?? filteredJobs[0] ?? scoredJobs[0]
  const sources = Array.from(new Set(scoredJobs.map(({ job }) => job.sourcePlatform))).sort()
  const activeFilterCount =
    filters.workModes.length +
    filters.jobTypes.length +
    filters.levels.length +
    filters.sources.length +
    (filters.scoreMin > 0 ? 1 : 0) +
    (filters.salaryMin > 0 ? 1 : 0)

  const handleApply = (scoredJob: ScoredJob) => {
    applyToJob(scoredJob.job.id)
    window.open(scoredJob.job.applyUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="panel p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="lg:min-w-[200px]">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan">Best matches for you</p>
            <h2 className="text-2xl font-bold text-ink">
              {filteredJobs.length} {filteredJobs.length === 1 ? 'job' : 'jobs'}
            </h2>
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <span className="field-shell normal-case min-w-[12rem] flex-1">
              <Search size={16} className="text-muted" />
              <input
                value={filters.search}
                onChange={(event) => setFilters({ search: event.target.value })}
                placeholder="Search title, company, skill…"
                aria-label="Search jobs"
              />
            </span>
            <PrettySelect<JobFilters['sort']>
              value={filters.sort}
              options={discoverySortOptions}
              onChange={(sort) => setFilters({ sort })}
              ariaLabel="Sort jobs"
              icon={<TrendingUp size={15} />}
            />
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              className={`inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${
                filtersOpen || activeFilterCount ? 'border-cyan bg-cyan/15 text-cyan' : 'border-line bg-panel text-ink hover:border-cyan/50'
              }`}
            >
              <SlidersHorizontal size={16} /> Filters
              {activeFilterCount ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan px-1 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
            <button
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-glow transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={liveSearch.status === 'loading'}
              onClick={() => void liveSearch.runLiveSearch(false)}
            >
              <RefreshCw size={16} className={liveSearch.status === 'loading' ? 'animate-spin' : ''} />
              {liveSearch.status === 'loading' ? 'Searching…' : 'Run live search'}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            className="rounded-lg border border-line bg-bg/60 px-3 py-1.5 text-xs font-medium text-muted transition hover:border-cyan/50 hover:text-ink"
            onClick={() => setFilters({ ...defaultFilters, scoreMin: 80 })}
          >
            80%+ match
          </button>
          <button
            className="rounded-lg border border-line bg-bg/60 px-3 py-1.5 text-xs font-medium text-muted transition hover:border-cyan/50 hover:text-ink"
            onClick={() => setFilters({ workModes: ['remote'], scoreMin: 70 })}
          >
            Remote only
          </button>
          {activeFilterCount ? (
            <button
              className="rounded-lg border border-line bg-bg/60 px-3 py-1.5 text-xs font-medium text-muted transition hover:border-danger/50 hover:text-danger"
              onClick={() => resetFilters()}
            >
              Clear filters
            </button>
          ) : null}
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted">
            <Globe2 size={13} className="text-cyan" />
            {lastLiveSearchAt
              ? `Updated ${formatDistanceToNowStrict(new Date(lastLiveSearchAt), { addSuffix: true })}`
              : 'No live search yet'}
          </span>
        </div>

        {liveSearch.message ? (
          <p className={`mt-3 text-xs ${liveSearch.status === 'error' ? 'text-danger' : 'text-muted'}`}>{liveSearch.message}</p>
        ) : null}

        {liveJobSources.length ? (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
            {liveJobSources.map((source) => (
              <span
                key={source.name}
                className={`rounded-lg border px-2 py-0.5 text-xs ${
                  source.ok ? 'border-success/30 bg-success/10 text-success' : 'border-danger/30 bg-danger/10 text-danger'
                }`}
                title={source.error}
              >
                {source.name}: {source.count}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Collapsible filters */}
      <AnimatePresence initial={false}>
        {filtersOpen ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <FilterPanel filters={filters} sources={sources} onChange={setFilters} onReset={resetFilters} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Feed + detail */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="min-w-0 space-y-3">
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
            <div className="panel p-10 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan/15 text-cyan">
                <Search size={26} />
              </span>
              <p className="mt-4 font-semibold text-ink">No jobs match your filters yet</p>
              <p className="mt-1 text-sm text-muted">Run a live search or clear filters to refresh your feed.</p>
            </div>
          )}
        </section>

        {selected ? (
          <JobDetailPanel
            scoredJob={selected}
            onApply={() => handleApply(selected)}
            onToggleSave={() => toggleSave(selected.job.id)}
          />
        ) : null}
      </div>
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
  const [dragOver, setDragOver] = useState(false)
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

  const steps = [
    {
      title: 'Set your target',
      text: profile.targetRoles?.[0] || profile.targetRole ? `Targeting ${profile.targetRoles?.[0] || profile.targetRole}.` : 'Tell us the role you want.',
      done: Boolean(profile.targetRoles?.[0] || profile.targetRole),
      icon: Target,
    },
    {
      title: 'Upload your CV',
      text: activeCv.skills.length ? `${activeCv.skills.length} skills detected from your CV.` : 'Drop a PDF or DOCX to detect your skills.',
      done: activeCv.skills.length > 0,
      icon: UploadCloud,
    },
    {
      title: 'Save preferences',
      text: profile.profileCompletedAt ? 'Preferences saved — ready to match.' : 'Confirm your preferences to unlock matching.',
      done: Boolean(profile.profileCompletedAt),
      icon: SlidersHorizontal,
    },
  ]

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragOver(false)
    const file = event.dataTransfer.files?.[0]
    if (file) void handleCvUpload(file)
  }

  return (
    <div className="space-y-6">
      <section className="panel relative overflow-hidden">
        <div className="grid gap-5 bg-gradient-to-br from-success/18 via-panel to-panel p-5 md:grid-cols-[1fr_auto] md:p-6">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-sm font-semibold text-success">
              <FileText size={16} />
              Your resume &amp; skills
            </div>
            <h2 className="text-2xl font-bold text-ink md:text-3xl">My CV</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Upload your CV once — we detect your skills, rank them, and use them to find jobs that fit.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center md:min-w-[360px]">
            <CvMetric label="Skills" value={activeCv.skills.length} />
            <CvMetric label="Avg level" value={`${averageSkillRank(activeCv.skills)}%`} />
            <CvMetric label="Years" value={activeCv.totalYearsExperience || 0} />
          </div>
        </div>
      </section>

      {/* Getting started */}
      <section className="panel p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-success/15 text-success">
            <Wand2 size={21} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-ink">Getting started</h2>
            <p className="text-sm text-muted">Three quick steps to unlock sharp job matches.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <div
                key={step.title}
                className={`rounded-2xl border p-4 transition ${step.done ? 'border-success/40 bg-success/5' : 'border-line bg-bg/50'}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${step.done ? 'bg-success/15 text-success' : 'bg-primary/15 text-primary'}`}>
                    {step.done ? <Check size={20} /> : <Icon size={18} />}
                  </span>
                  <span className="font-mono text-2xl font-black text-line">0{index + 1}</span>
                </div>
                <p className="mt-4 font-semibold text-ink">{step.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted">{step.text}</p>
              </div>
            )
          })}
        </div>

        {/* Upload zone */}
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`mt-5 flex min-h-[190px] items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition ${
            dragOver ? 'border-success bg-success/10' : 'border-line bg-bg/40'
          }`}
        >
          <div>
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success/15 text-success">
              <UploadCloud size={28} />
            </span>
            <p className="mt-3 text-base font-semibold text-ink">Drag &amp; drop your CV here</p>
            <p className="mt-1 text-xs text-muted">PDF, DOCX, DOC, or TXT — parsed privately on your device.</p>
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
              className="primary-button mt-4 rounded-xl"
              disabled={parseStatus === 'uploading'}
              onClick={() => fileInputRef.current?.click()}
            >
              {parseStatus === 'uploading' ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> Parsing…
                </>
              ) : (
                <>
                  <UploadCloud size={16} /> Browse files
                </>
              )}
            </button>
            {parseMessage ? (
              <p className={`mt-3 text-xs ${parseStatus === 'error' ? 'text-danger' : parseStatus === 'done' ? 'text-success' : 'text-muted'}`}>
                {parseMessage}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        {/* Search preferences */}
        <div className="panel p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan/15 text-cyan">
              <Search size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ink">Search preferences</h2>
              <p className="text-sm text-muted">The role and location we use to fetch live jobs.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field-label">
              Target role
              <span className="field-shell normal-case">
                <Briefcase size={16} className="text-muted" />
                <input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} placeholder="Frontend Engineer" />
              </span>
            </label>
            <label className="field-label">
              Years of experience
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
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line bg-bg/60 px-3 text-sm font-medium text-ink transition hover:border-cyan/60 sm:col-span-2">
              <input type="checkbox" className="h-4 w-4 accent-cyan" checked={preferredRemote} onChange={(event) => setPreferredRemote(event.target.checked)} />
              I prefer remote roles
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="secondary-button" onClick={saveProfileSignal}>
              <Save size={16} /> Save
            </button>
            <button type="button" className="primary-button" disabled={liveSearch.status === 'loading'} onClick={searchFromCv}>
              <Rocket size={16} />
              {liveSearch.status === 'loading' ? 'Searching…' : 'Search live jobs'}
            </button>
          </div>
          {[profileMessage, liveSearch.message].filter(Boolean).map((message) => (
            <p key={message} className={`mt-3 text-xs ${liveSearch.status === 'error' && message === liveSearch.message ? 'text-danger' : 'text-muted'}`}>
              {message}
            </p>
          ))}
        </div>

        {/* CV versions */}
        <div className="panel p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <h2 className="text-lg font-semibold text-ink">Your CVs</h2>
              <p className="mt-1 text-sm text-muted">Switch the active CV or remove old versions.</p>
            </div>
            <button
              type="button"
              className="secondary-button border-danger/45 text-danger hover:border-danger hover:bg-danger/10"
              disabled={!cvs.length}
              onClick={handleClearCvData}
            >
              <Trash2 size={16} /> Clear all
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {cvs.length ? (
              cvs.map((cv) => (
                <article
                  key={cv.id}
                  className={`rounded-2xl border p-4 transition ${cv.isActive ? 'border-success bg-success/10' : 'border-line bg-bg/50 hover:border-success/50'}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{cv.label}</p>
                      <p className="mt-1 text-xs text-muted">
                        v{cv.version} · {cv.skills.length} skills · {cv.totalYearsExperience || 0} yrs
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {cv.isActive ? (
                        <span className="inline-flex h-9 items-center gap-1 rounded-lg bg-success/15 px-3 text-xs font-semibold text-success">
                          <Check size={14} /> Active
                        </span>
                      ) : (
                        <button type="button" className="secondary-button h-9 px-3 text-xs" onClick={() => activateCv(cv.id)}>
                          <CheckCircle2 size={14} /> Use this
                        </button>
                      )}
                      <button
                        type="button"
                        className="secondary-button h-9 border-danger/45 px-3 text-xs text-danger hover:border-danger hover:bg-danger/10"
                        onClick={() => handleDeleteCv(cv)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-line bg-bg/40 p-6 text-center text-sm text-muted">
                No CV yet. Upload one above or add skills below to create your first profile.
              </p>
            )}
          </div>
          {cvDataMessage ? <p className="mt-3 text-xs text-muted">{cvDataMessage}</p> : null}
        </div>
      </section>

      {/* Skills board */}
      <section className="panel p-5">
        <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-success/15 text-success">
              <Sparkles size={21} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-ink">Your skills</h2>
              <p className="text-sm text-muted">Add skills and drag the bar to set how strong you are at each.</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-success/30 bg-success/10 px-3 py-1 text-sm font-semibold text-success">
            {activeCv.skills.length} skills
          </span>
        </div>
        {lastParsedCv?.warnings.length ? (
          <div className="mb-4 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
            {lastParsedCv.warnings.join(' ')}
          </div>
        ) : null}
        <SkillsBoard
          skills={activeCv.skills}
          onAdd={(name, rank) =>
            upsertSkill({
              skillName: name,
              skillCanonical: name,
              skillType: 'technical',
              yearsUsed: 0,
              skillRank: rank,
              confidence: 'medium',
              isManual: true,
            })
          }
          onUpdate={(next, previousCanonical) => upsertSkill(next, previousCanonical)}
          onRemove={removeSkill}
        />
      </section>

      {/* Education */}
      <section className="panel p-5">
        <h2 className="text-lg font-semibold text-ink">Education &amp; certificates</h2>
        {lastParsedCv ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {[...lastParsedCv.education, ...lastParsedCv.certifications].length ? (
              [...lastParsedCv.education, ...lastParsedCv.certifications].map((item) => (
                <span key={item} className="rounded-lg border border-line bg-bg/60 px-3 py-2 text-sm text-muted">
                  {item}
                </span>
              ))
            ) : (
              <p className="text-sm text-muted">No education or certificates were detected in your CV.</p>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm leading-6 text-muted">Upload a CV to extract your education and certificates.</p>
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

function CvMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-line bg-bg/65 p-4">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
    </div>
  )
}

function averageSkillRank(skills: CvSkill[]) {
  if (!skills.length) return 0
  return Math.round(skills.reduce((total, skill) => total + (skill.skillRank || 0), 0) / skills.length)
}

function TrackerPage() {
  const view = useWorkspaceView()
  const { applications, profile, activeCv, jobs } = view
  const updateApplicationStatus = useJobmatchStore((state) => state.updateApplicationStatus)
  const addCustomJobRecord = useJobmatchStore((state) => state.addCustomJobRecord)
  const [showCustomJobForm, setShowCustomJobForm] = useState(false)
  const savedJobIds = useMemo(
    () => applications.filter((a) => a.status === 'saved').map((a) => a.jobId),
    [applications],
  )
  const scoredJobs = useMemo(() => scoreJobs(profile, activeCv, jobs, savedJobIds), [profile, activeCv, jobs, savedJobIds])

  return (
    <div className="space-y-5">
      <div className="panel flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-warning">Your pipeline</p>
          <h2 className="text-2xl font-bold text-ink">
            {applications.length} {applications.length === 1 ? 'application' : 'applications'}
          </h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {!view.readOnly ? (
            <button className="primary-button" onClick={() => setShowCustomJobForm(true)}>
              <Plus size={16} />
              Add custom job record
            </button>
          ) : null}
          <button className="secondary-button" onClick={() => downloadApplications(applications, scoredJobs)}>
            <ClipboardList size={16} />
            Export CSV
          </button>
        </div>
      </div>
      <KanbanBoard
        applications={applications}
        scoredJobs={scoredJobs}
        onMove={(applicationId, status) => updateApplicationStatus(applicationId, status)}
        readOnly={view.readOnly}
      />
      {showCustomJobForm && !view.readOnly ? (
        <CustomJobRecordModal
          profile={profile}
          activeCv={activeCv}
          onClose={() => setShowCustomJobForm(false)}
          onSave={(input) => {
            addCustomJobRecord(input)
            setShowCustomJobForm(false)
          }}
        />
      ) : null}
    </div>
  )
}

const customJobStatusOptions: Array<{ value: ApplicationStatus; label: string }> = [
  { value: 'saved', label: 'Saved' },
  { value: 'applied', label: 'Applied' },
  { value: 'interviewing', label: 'Interviewing' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
]

const customJobWorkModeOptions: Array<{ value: WorkMode; label: string }> = [
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
]

const customJobTypeOptions: Array<{ value: JobType; label: string }> = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'internship', label: 'Internship' },
]

const customJobLevelOptions: Array<{ value: ExperienceLevel; label: string }> = [
  { value: 'entry', label: 'Entry' },
  { value: 'mid', label: 'Mid' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead' },
  { value: 'executive', label: 'Executive' },
]

interface CustomJobRecordFormState {
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
  skillsText: string
  salaryMin: string
  salaryMax: string
  salaryCurrency: string
  experienceMin: string
  experienceMax: string
  reminderDate: string
}

function CustomJobRecordModal({
  profile,
  activeCv,
  onClose,
  onSave,
}: {
  profile: UserProfile
  activeCv: CvProfile
  onClose: () => void
  onSave: (input: {
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
  }) => void
}) {
  const defaultSkills = [
    ...profile.mustHaveSkills,
    ...activeCv.skills
      .slice()
      .sort((a, b) => (b.skillRank || 0) - (a.skillRank || 0))
      .map((skill) => skill.skillName),
  ]
    .filter(Boolean)
    .slice(0, 8)

  const [form, setForm] = useState<CustomJobRecordFormState>({
    title: profile.targetRoles[0] || profile.targetRole || '',
    company: '',
    location: profile.location || 'Remote',
    country: profile.preferredCountries[0] || 'Remote',
    city: profile.preferredCities[0] || 'Remote',
    workMode: profile.remotePreference === 'hybrid' || profile.remotePreference === 'onsite' ? profile.remotePreference : 'remote',
    jobType: 'full_time',
    level: profile.experienceYears >= 8 ? 'lead' : profile.experienceYears >= 4 ? 'senior' : profile.experienceYears >= 1 ? 'mid' : 'entry',
    status: 'saved',
    applyUrl: '',
    description: '',
    notes: '',
    skillsText: Array.from(new Set(defaultSkills)).join(', '),
    salaryMin: profile.minimumSalary ? String(profile.minimumSalary) : '',
    salaryMax: '',
    salaryCurrency: profile.currency || 'USD',
    experienceMin: profile.experienceYears ? String(profile.experienceYears) : '',
    experienceMax: '',
    reminderDate: '',
  })
  const [error, setError] = useState('')

  const updateField = <K extends keyof CustomJobRecordFormState>(key: K, value: CustomJobRecordFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const title = form.title.trim()
    const company = form.company.trim()
    if (!title || !company) {
      setError('Job title and company are required.')
      return
    }

    const applyUrl = form.applyUrl.trim()
    if (applyUrl && !/^https?:\/\//i.test(applyUrl)) {
      setError('Job link must start with http:// or https://.')
      return
    }

    onSave({
      title,
      company,
      location: form.location.trim() || [form.city, form.country].filter(Boolean).join(', ') || 'Remote',
      country: form.country.trim() || 'Remote',
      city: form.city.trim() || 'Remote',
      workMode: form.workMode,
      jobType: form.jobType,
      level: form.level,
      status: form.status,
      applyUrl,
      description: form.description,
      notes: form.notes,
      skills: form.skillsText.split(',').map((skill) => skill.trim()).filter(Boolean),
      salaryMin: clampPositiveInteger(form.salaryMin, 0, 2_000_000),
      salaryMax: clampPositiveInteger(form.salaryMax, 0, 2_000_000),
      salaryCurrency: form.salaryCurrency.trim().toUpperCase().slice(0, 3) || 'USD',
      experienceMin: clampPositiveInteger(form.experienceMin, 0, 60),
      experienceMax: clampPositiveInteger(form.experienceMax, 0, 60),
      reminderDate: form.reminderDate || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <section className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-line bg-panel shadow-soft">
        <div className="flex items-start justify-between gap-4 border-b border-line p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-warning">Custom job record</p>
            <h2 className="mt-1 text-2xl font-bold text-ink">Add a job to your tracker</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close custom job form" title="Close">
            <X size={18} />
          </button>
        </div>

        <form className="space-y-5 p-5" onSubmit={submit}>
          {error ? (
            <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <CustomJobTextField
              label="Job title"
              value={form.title}
              onChange={(value) => updateField('title', value)}
              placeholder="Senior Frontend Engineer"
              required
            />
            <CustomJobTextField
              label="Company"
              value={form.company}
              onChange={(value) => updateField('company', value)}
              placeholder="Acme Cloud"
              required
            />
            <CustomJobTextField
              label="Location"
              value={form.location}
              onChange={(value) => updateField('location', value)}
              placeholder="Remote, London, Dubai"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <CustomJobTextField
                label="Country"
                value={form.country}
                onChange={(value) => updateField('country', value)}
                placeholder="United States"
              />
              <CustomJobTextField
                label="City"
                value={form.city}
                onChange={(value) => updateField('city', value)}
                placeholder="New York"
              />
            </div>
            <label className="field-label">
              Status
              <PrettySelect<ApplicationStatus>
                className="mt-2 normal-case"
                value={form.status}
                options={customJobStatusOptions}
                onChange={(value) => updateField('status', value)}
                ariaLabel="Custom job status"
              />
            </label>
            <label className="field-label">
              Work mode
              <PrettySelect<WorkMode>
                className="mt-2 normal-case"
                value={form.workMode}
                options={customJobWorkModeOptions}
                onChange={(value) => updateField('workMode', value)}
                ariaLabel="Custom job work mode"
              />
            </label>
            <label className="field-label">
              Job type
              <PrettySelect<JobType>
                className="mt-2 normal-case"
                value={form.jobType}
                options={customJobTypeOptions}
                onChange={(value) => updateField('jobType', value)}
                ariaLabel="Custom job type"
              />
            </label>
            <label className="field-label">
              Level
              <PrettySelect<ExperienceLevel>
                className="mt-2 normal-case"
                value={form.level}
                options={customJobLevelOptions}
                onChange={(value) => updateField('level', value)}
                ariaLabel="Custom job level"
              />
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <CustomJobNumberField label="Salary min" value={form.salaryMin} onChange={(value) => updateField('salaryMin', value)} placeholder="70000" />
            <CustomJobNumberField label="Salary max" value={form.salaryMax} onChange={(value) => updateField('salaryMax', value)} placeholder="120000" />
            <CustomJobTextField label="Currency" value={form.salaryCurrency} onChange={(value) => updateField('salaryCurrency', value.toUpperCase())} placeholder="USD" maxLength={3} />
            <CustomJobNumberField label="Experience min" value={form.experienceMin} onChange={(value) => updateField('experienceMin', value)} placeholder="2" />
            <CustomJobNumberField label="Experience max" value={form.experienceMax} onChange={(value) => updateField('experienceMax', value)} placeholder="6" />
            <label className="field-label">
              Reminder date
              <span className="field-shell normal-case">
                <CalendarDays size={16} className="text-muted" />
                <input type="date" value={form.reminderDate} onChange={(event) => updateField('reminderDate', event.target.value)} />
              </span>
            </label>
          </div>

          <CustomJobTextField
            label="Required skills"
            value={form.skillsText}
            onChange={(value) => updateField('skillsText', value)}
            placeholder="React, TypeScript, AWS"
          />
          <CustomJobTextField
            label="Job link"
            value={form.applyUrl}
            onChange={(value) => updateField('applyUrl', value)}
            placeholder="https://company.com/careers/job"
          />
          <CustomJobTextarea
            label="Job description"
            value={form.description}
            onChange={(value) => updateField('description', value)}
            placeholder="Paste the job description or key responsibilities."
          />
          <CustomJobTextarea
            label="Application notes"
            value={form.notes}
            onChange={(value) => updateField('notes', value)}
            placeholder="Referral, recruiter name, next steps, salary notes..."
          />

          <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end">
            <button type="button" className="secondary-button h-11" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-button h-11">
              <Save size={16} />
              Save custom job
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function CustomJobTextField({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  maxLength = 180,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  required?: boolean
  maxLength?: number
}) {
  return (
    <label className="field-label">
      {label}
      <span className="field-shell normal-case">
        <input
          required={required}
          value={value}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      </span>
    </label>
  )
}

function CustomJobNumberField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <label className="field-label">
      {label}
      <span className="field-shell normal-case">
        <input
          type="number"
          min="0"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      </span>
    </label>
  )
}

function CustomJobTextarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <label className="field-label">
      {label}
      <textarea
        className="control mt-2 min-h-28 w-full rounded-md px-3 py-3 text-sm normal-case outline-none"
        value={value}
        maxLength={4000}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}

function clampPositiveInteger(value: string, min: number, max: number) {
  const number = Number(value)
  if (!Number.isFinite(number)) return min
  return Math.min(Math.max(Math.round(number), min), max)
}

const NOTIF_META: Record<string, { icon: typeof Bell; accent: Accent }> = {
  new_match: { icon: Sparkles, accent: 'success' },
  job_expiry: { icon: CalendarDays, accent: 'warning' },
  follow_up_reminder: { icon: BellRing, accent: 'pink' },
  system: { icon: ShieldCheck, accent: 'primary' },
  new_source: { icon: Globe2, accent: 'cyan' },
}

function AlertsPage() {
  const view = useWorkspaceView()
  const notifications = view.notifications
  const markAllNotificationsRead = useJobmatchStore((state) => state.markAllNotificationsRead)
  const unread = notifications.filter((notification) => !notification.isRead).length

  return (
    <section className="panel p-5">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-pink">Notifications</p>
          <h2 className="text-2xl font-bold text-ink">Alerts &amp; reminders</h2>
        </div>
        {!view.readOnly && unread ? (
          <button className="primary-button rounded-xl" onClick={markAllNotificationsRead}>
            <Check size={16} /> Mark all read
          </button>
        ) : null}
      </div>
      {notifications.length ? (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const meta = NOTIF_META[notification.type] ?? { icon: Bell, accent: 'primary' as Accent }
            const Icon = meta.icon
            return (
              <article
                key={notification.id}
                className={`flex items-start gap-3 rounded-2xl border p-4 transition ${
                  notification.isRead ? 'border-line bg-bg/40' : 'border-pink/30 bg-pink/5'
                }`}
              >
                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${ACCENT_SOFT[meta.accent]}`}>
                  <Icon size={17} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-ink">{notification.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted">{notification.message}</p>
                  <p className="mt-2 text-xs text-muted">
                    {formatDistanceToNowStrict(new Date(notification.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {!notification.isRead ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-pink" /> : null}
              </article>
            )
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-line bg-bg/40 p-10 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-pink/15 text-pink">
            <Inbox size={26} />
          </span>
          <p className="mt-4 font-semibold text-ink">You're all caught up</p>
          <p className="mt-1 text-sm text-muted">New matches and reminders will show up here.</p>
        </div>
      )}
    </section>
  )
}

function AdminPage() {
  const liveJobSources = useJobmatchStore((state) => state.liveJobSources)

  return (
    <div className="space-y-6">
      <AdminConsole />

      <section className="panel overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan/15 text-cyan">
            <Network size={18} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-ink">Live job source status</h2>
            <p className="text-sm text-muted">The most recent live extraction run across your connected sources.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-bg/60 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Source</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 text-right font-semibold">Jobs</th>
                <th className="px-5 py-3 font-semibold">Message</th>
              </tr>
            </thead>
            <tbody>
              {liveJobSources.length ? (
                liveJobSources.map((source) => (
                  <tr key={source.name} className="border-t border-line/60">
                    <td className="px-5 py-3 font-semibold text-ink">{source.name}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${source.ok ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${source.ok ? 'bg-success' : 'bg-danger'}`} />
                        {source.ok ? 'Healthy' : 'Failed'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-ink">{source.count}</td>
                    <td className="px-5 py-3 text-muted">{source.error || 'OK'}</td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-line/60">
                  <td className="px-5 py-6 text-sm text-muted" colSpan={4}>
                    No live extraction has run yet. Run a search from Find Jobs to populate source status.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <HealthTile label="Database" value="Healthy" icon={<DatabaseZap size={18} />} />
        <HealthTile label="Auth" value="Supabase JWT + RLS" icon={<LockKeyhole size={18} />} />
        <HealthTile label="CV parser" value="On-device" icon={<FileText size={18} />} />
        <HealthTile label="Live sources" value={`${liveJobSources.length || 6} configured`} icon={<Globe2 size={18} />} />
      </section>
    </div>
  )
}

const settingsServices: { label: string; detail: string; icon: typeof Bell; accent: Accent }[] = [
  { label: 'Supabase', detail: 'Auth, database, and row-level security for your account.', icon: DatabaseZap, accent: 'primary' },
  { label: 'CV parser', detail: 'PDF, DOCX, DOC, and TXT parsed locally on your device.', icon: FileText, accent: 'success' },
  { label: 'Live job sources', detail: 'Google Jobs, Adzuna, Jooble, RemoteOK and more.', icon: Globe2, accent: 'cyan' },
  { label: 'Email (Brevo)', detail: 'Branded password-reset and digest emails.', icon: Mail, accent: 'violet' },
  { label: 'Rate limiting', detail: 'Upstash Redis protects the live API routes.', icon: Gauge, accent: 'warning' },
]

function SettingsPage() {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
      <section className="panel p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <DatabaseZap size={18} />
          </span>
          <h2 className="text-lg font-semibold text-ink">Integrations &amp; services</h2>
        </div>
        <div className="space-y-3">
          {settingsServices.map((service) => {
            const Icon = service.icon
            return (
              <div key={service.label} className="flex items-start gap-3 rounded-2xl border border-line bg-bg/50 p-4">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${ACCENT_SOFT[service.accent]}`}>
                  <Icon size={16} />
                </span>
                <div>
                  <p className="font-semibold text-ink">{service.label}</p>
                  <p className="mt-1 text-sm text-muted">{service.detail}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="panel p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/15 text-success">
            <ShieldCheck size={18} />
          </span>
          <h2 className="text-lg font-semibold text-ink">Security &amp; privacy</h2>
        </div>
        <div className="space-y-3">
          <SecurityRow icon={<LockKeyhole size={17} />} title="JWT + Row-Level Security" text="Your data is scoped to your account by Supabase policies." />
          <SecurityRow icon={<ShieldCheck size={17} />} title="Sanitized content" text="Job HTML is cleaned with DOMPurify before it renders." />
          <SecurityRow icon={<FileText size={17} />} title="Local CV parsing" text="Resume files are parsed on your device, not uploaded to an AI." />
          <SecurityRow icon={<LogOut size={17} />} title="Export & deletion" text="GDPR-ready export and account deletion are part of the schema." />
        </div>
      </section>
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
