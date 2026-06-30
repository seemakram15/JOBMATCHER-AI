import { useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface SpotlightCardProps {
  children: ReactNode
  className?: string
  /** rgb triplet string, e.g. "74 144 217". Defaults to the primary color var. */
  glow?: string
}

/**
 * Card with a cursor-following radial spotlight (reactbits-style).
 * Falls back gracefully to a static surface when the pointer is away.
 */
export function SpotlightCard({ children, className, glow = 'var(--color-primary)' }: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [active, setActive] = useState(false)

  const onMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    setPos({ x: event.clientX - rect.left, y: event.clientY - rect.top })
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-line bg-panel/70 transition-colors duration-300 hover:border-primary/40',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300"
        style={{
          opacity: active ? 1 : 0,
          background: `radial-gradient(420px circle at ${pos.x}px ${pos.y}px, rgb(${glow} / 0.16), transparent 70%)`,
        }}
      />
      <div className="relative">{children}</div>
    </div>
  )
}
