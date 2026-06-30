import { useRef, type ReactNode } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

interface MagneticButtonProps {
  children: ReactNode
  className?: string
  /** Pull strength in px at the edges. */
  strength?: number
}

/**
 * Button wrapper that gently follows the cursor (magnetic hover effect).
 * Uses Framer motion values (no React re-render) and caches the bounding rect
 * on enter so pointer-move does zero layout reads.
 */
export function MagneticButton({ children, className, strength = 14 }: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null)
  const rect = useRef<DOMRect | null>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 220, damping: 16, mass: 0.4 })
  const sy = useSpring(y, { stiffness: 220, damping: 16, mass: 0.4 })

  const onEnter = () => {
    rect.current = ref.current?.getBoundingClientRect() ?? null
  }

  const onMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const box = rect.current
    if (!box) return
    const relX = (event.clientX - box.left) / box.width - 0.5
    const relY = (event.clientY - box.top) / box.height - 0.5
    x.set(relX * strength * 2)
    y.set(relY * strength * 2)
  }

  const reset = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      ref={ref}
      onMouseEnter={onEnter}
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={{ x: sx, y: sy }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
