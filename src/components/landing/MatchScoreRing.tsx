import { useEffect, useRef, useState } from 'react'
import { useInView } from 'framer-motion'
import { cn } from '../../lib/cn'

interface MatchScoreRingProps {
  score: number
  size?: number
  stroke?: number
  className?: string
}

/** Circular progress ring that sweeps to the match score when in view. */
export function MatchScoreRing({ score, size = 132, stroke = 10, className }: MatchScoreRingProps) {
  const ref = useRef<SVGSVGElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const [shown, setShown] = useState(0)
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dash = circumference * (1 - shown / 100)

  useEffect(() => {
    if (!inView) return
    let raf = 0
    let start: number | null = null
    const step = (now: number) => {
      if (start === null) start = now
      const progress = Math.min((now - start) / 1400, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setShown(score * eased)
      if (progress < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [inView, score])

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg ref={ref} width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgb(var(--color-line))" strokeWidth={stroke} />
        <defs>
          <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgb(var(--color-primary))" />
            <stop offset="60%" stopColor="rgb(var(--color-cyan))" />
            <stop offset="100%" stopColor="rgb(var(--color-success))" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#scoreGradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dash}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-3xl font-bold text-ink">{Math.round(shown)}%</span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">match</span>
      </div>
    </div>
  )
}
