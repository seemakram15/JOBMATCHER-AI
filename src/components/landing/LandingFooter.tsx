import {
  BriefcaseBusiness,
  FileText,
  Github,
  Globe2,
  Linkedin,
  Mail,
  ShieldCheck,
  Twitter,
} from 'lucide-react'

const socials = [
  { icon: Twitter, label: 'Twitter' },
  { icon: Linkedin, label: 'LinkedIn' },
  { icon: Github, label: 'GitHub' },
  { icon: Mail, label: 'Email' },
]

export function LandingFooter() {
  return (
    <footer className="relative mt-24 overflow-hidden border-t border-line bg-bg pt-16">
      <div className="relative z-10 mx-auto max-w-7xl px-5 md:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-md">
            <div className="flex items-center gap-3">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-glow">
                <BriefcaseBusiness size={22} />
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-success text-[9px] font-black text-white">
                  %
                </span>
              </div>
              <div>
                <p className="text-lg font-extrabold leading-5 text-ink">Jobmatcher</p>
                <p className="text-xs font-medium text-muted">Upload. Match. Apply smarter.</p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-6 text-muted">
              An AI-ranked job discovery and application workspace. Upload your CV once, surface live roles that fit, and
              track every application in one place.
            </p>
          </div>

          <div className="flex gap-2">
            {socials.map(({ icon: Icon, label }) => (
              <button
                key={label}
                aria-label={label}
                title={label}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-panel/70 text-muted transition hover:-translate-y-0.5 hover:border-primary hover:text-primary"
              >
                <Icon size={17} />
              </button>
            ))}
          </div>
        </div>

        {/* Disclaimer / meta row */}
        <div className="mt-12 flex flex-col gap-6 border-t border-line py-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck size={14} className="text-success" /> Your data stays scoped to your account
            </span>
            <span className="inline-flex items-center gap-2">
              <Globe2 size={14} className="text-primary" /> Live sources may rate-limit or be delayed
            </span>
            <span className="inline-flex items-center gap-2">
              <FileText size={14} className="text-cyan" /> CV parsing runs locally
            </span>
          </div>
          <p className="max-w-xl text-xs leading-5 text-muted/80">
            For personal use. Market data may be delayed. Not investment advice. Job listings are aggregated from
            third-party sources and may change or expire without notice. Match scores are guidance only — always verify
            roles with the original employer before applying.
          </p>
        </div>

        <div className="pb-44 pt-2 text-xs text-muted">
          <p>© {new Date().getFullYear()} Jobmatcher. All rights reserved.</p>
        </div>
      </div>

      {/* Giant brand wordmark bleeding off the bottom edge */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 flex justify-center overflow-hidden">
        <span
          aria-hidden
          className="select-none whitespace-nowrap bg-gradient-to-b from-ink/[0.10] to-ink/0 bg-clip-text text-[24vw] font-black leading-[0.78] tracking-tighter text-transparent"
          style={{ WebkitTextFillColor: 'transparent' }}
        >
          Jobmatcher
        </span>
      </div>
    </footer>
  )
}
