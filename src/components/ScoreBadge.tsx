import { motion } from 'framer-motion'
import { getScoreLabel } from '../lib/scoring'

interface ScoreBadgeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
}

const colorClasses = {
  success: 'border-success/40 bg-success/15 text-success',
  cyan: 'border-cyan/40 bg-cyan/15 text-cyan',
  warning: 'border-warning/40 bg-warning/15 text-warning',
  orange: 'border-orange-400/40 bg-orange-400/15 text-orange-300',
  danger: 'border-danger/40 bg-danger/15 text-danger',
}

const sizes = {
  sm: 'h-12 w-12 text-sm',
  md: 'h-16 w-16 text-lg',
  lg: 'h-20 w-20 text-2xl',
}

export function ScoreBadge({ score, size = 'md' }: ScoreBadgeProps) {
  const scoreMeta = getScoreLabel(score)

  return (
    <motion.div
      aria-label={`${score} percent match, ${scoreMeta.label}`}
      className={`flex shrink-0 flex-col items-center justify-center rounded-md border font-mono font-bold ${sizes[size]} ${
        colorClasses[scoreMeta.color as keyof typeof colorClasses]
      }`}
      initial={{ scale: 0.86, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      <span>{score}</span>
      <span className="text-[10px] leading-none">%</span>
    </motion.div>
  )
}
