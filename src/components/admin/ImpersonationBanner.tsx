import { Eye, LogOut } from 'lucide-react'
import { useJobmatchStore } from '../../store/useJobmatchStore'

/** Persistent banner shown while an admin is viewing another user's workspace. */
export function ImpersonationBanner() {
  const impersonation = useJobmatchStore((state) => state.impersonation)
  const exitImpersonation = useJobmatchStore((state) => state.exitImpersonation)

  if (!impersonation) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-violet to-primary px-4 py-2 text-sm font-medium text-white md:px-6">
      <span className="inline-flex items-center gap-2">
        <Eye size={16} />
        Viewing <strong className="font-bold">{impersonation.email}</strong>
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide">Read only</span>
      </span>
      <button
        type="button"
        onClick={exitImpersonation}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold transition hover:bg-white/30"
      >
        <LogOut size={14} /> Exit view-as
      </button>
    </div>
  )
}
