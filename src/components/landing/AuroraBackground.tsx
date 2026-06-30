import { cn } from '../../lib/cn'

/**
 * Animated aurora / mesh-gradient backdrop with a faint grid overlay.
 * Pure CSS animation (GPU transforms) so it stays cheap and respects
 * prefers-reduced-motion via the global guard in index.css.
 */
export function AuroraBackground({ className, withGrid = true }: { className?: string; withGrid?: boolean }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      <div className="absolute -left-[12%] -top-[18%] h-[42rem] w-[42rem] animate-aurora rounded-full bg-primary/30 blur-[120px]" />
      <div
        className="absolute -right-[10%] top-[6%] h-[34rem] w-[34rem] animate-aurora rounded-full bg-cyan/25 blur-[120px]"
        style={{ animationDelay: '-6s', animationDuration: '22s' }}
      />
      <div
        className="absolute bottom-[-16%] left-[28%] h-[36rem] w-[36rem] animate-aurora rounded-full bg-success/20 blur-[130px]"
        style={{ animationDelay: '-11s', animationDuration: '26s' }}
      />
      {withGrid ? <div className="grid-bg absolute inset-0" /> : null}
    </div>
  )
}
