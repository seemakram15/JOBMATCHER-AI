import { useRef, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface SpotlightCardProps {
  children: ReactNode
  className?: string
  /** rgb triplet expression, e.g. "var(--color-primary)" or "99 102 241". */
  glow?: string
}

/**
 * Card with a cursor-following radial spotlight.
 * Updates a sibling layer directly via refs + rAF — no React state, so moving
 * the pointer never triggers a re-render (keeps scrolling/hover buttery).
 */
export function SpotlightCard({ children, className, glow = 'var(--color-primary)' }: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const frame = useRef(0)

  const onMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (frame.current) return
    const clientX = event.clientX
    const clientY = event.clientY
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      const el = ref.current
      const layer = glowRef.current
      if (!el || !layer) return
      const rect = el.getBoundingClientRect()
      layer.style.background = `radial-gradient(420px circle at ${clientX - rect.left}px ${clientY - rect.top}px, rgb(${glow} / 0.16), transparent 70%)`
    })
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => glowRef.current && (glowRef.current.style.opacity = '1')}
      onMouseLeave={() => glowRef.current && (glowRef.current.style.opacity = '0')}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-line bg-panel/70 transition-colors duration-300 hover:border-primary/40',
        className,
      )}
    >
      <div ref={glowRef} className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300" />
      <div className="relative">{children}</div>
    </div>
  )
}
