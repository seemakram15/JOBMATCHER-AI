import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface MarqueeProps {
  children: ReactNode
  /** Seconds for one full loop. Lower = faster. */
  speed?: number
  reverse?: boolean
  pauseOnHover?: boolean
  className?: string
  itemClassName?: string
}

/**
 * Infinite, seamless horizontal auto-scroller (reactbits-style).
 * Content is rendered twice and translated by -50% so the loop is gapless.
 */
export function Marquee({
  children,
  speed = 40,
  reverse = false,
  pauseOnHover = true,
  className,
  itemClassName,
}: MarqueeProps) {
  return (
    <div className={cn('marquee-mask group relative flex w-full overflow-hidden', className)}>
      {[0, 1].map((copy) => (
        <div
          key={copy}
          aria-hidden={copy === 1}
          className={cn(
            'flex shrink-0 items-center',
            reverse ? 'animate-marquee-reverse' : 'animate-marquee',
            pauseOnHover && 'group-hover:[animation-play-state:paused]',
            itemClassName,
          )}
          style={{ ['--marquee-duration' as string]: `${speed}s` }}
        >
          {children}
        </div>
      ))}
    </div>
  )
}
