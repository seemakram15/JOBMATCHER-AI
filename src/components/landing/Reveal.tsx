import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

type Direction = 'up' | 'down' | 'left' | 'right' | 'none'

const offset: Record<Direction, { x?: number; y?: number }> = {
  up: { y: 28 },
  down: { y: -28 },
  left: { x: 28 },
  right: { x: -28 },
  none: {},
}

interface RevealProps {
  children: ReactNode
  delay?: number
  direction?: Direction
  className?: string
  /** Re-animate every time it enters the viewport instead of only once. */
  repeat?: boolean
}

/** Scroll-triggered fade + slide reveal powered by Framer Motion. */
export function Reveal({ children, delay = 0, direction = 'up', className, repeat = false }: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...offset[direction] }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: !repeat, amount: 0.25 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}
