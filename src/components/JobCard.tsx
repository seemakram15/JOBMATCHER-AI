import { Bookmark, Briefcase, Clock3, DollarSign, MapPin } from 'lucide-react'
import { motion } from 'framer-motion'
import { formatDistanceToNowStrict } from 'date-fns'
import { ScoreBadge } from './ScoreBadge'
import type { ScoredJob } from '../types'

interface JobCardProps {
  scoredJob: ScoredJob
  isActive: boolean
  onSelect: () => void
  onToggleSave: () => void
}

const jobTypeLabel: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  freelance: 'Freelance',
  internship: 'Internship',
}

const formatSalary = (min?: number, max?: number, currency = 'USD') => {
  if (!min && !max) return 'Salary open'
  const compact = new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
    notation: 'compact',
  })
  return `${min ? compact.format(min) : ''}${min && max ? '-' : ''}${max ? compact.format(max) : ''}`
}

export function JobCard({ scoredJob, isActive, onSelect, onToggleSave }: JobCardProps) {
  const { job, match, isSaved } = scoredJob

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      className={`border bg-panel/88 p-4 transition ${
        isActive ? 'border-primary shadow-soft' : 'border-line hover:border-primary/70'
      }`}
    >
      <button className="block w-full text-left" onClick={onSelect}>
        <div className="flex gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary/15 font-mono text-sm font-bold text-primary">
            {job.companyLogo ?? job.company.slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-muted">{job.company}</p>
                <h3 className="mt-0.5 line-clamp-2 text-base font-semibold text-ink">{job.title}</h3>
              </div>
              <ScoreBadge score={match.totalScore} size="sm" />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} /> {job.location}
              </span>
              <span className="inline-flex items-center gap-1">
                <DollarSign size={13} /> {formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Briefcase size={13} /> {jobTypeLabel[job.jobType]}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock3 size={13} /> {formatDistanceToNowStrict(new Date(job.postedAt), { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>
      </button>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap gap-2">
          {job.skillsRequired.slice(0, 4).map((skill) => (
            <span
              key={skill.skill}
              className={`rounded-md border px-2 py-1 text-xs ${
                match.matchedSkills.includes(skill.skill)
                  ? 'border-success/30 bg-success/10 text-success'
                  : 'border-line bg-bg/80 text-muted'
              }`}
            >
              {skill.skill}
            </span>
          ))}
        </div>
        <button
          className={`icon-button ${isSaved ? 'border-primary text-primary' : ''}`}
          onClick={onToggleSave}
          aria-label={isSaved ? `Unsave ${job.title}` : `Save ${job.title}`}
          title={isSaved ? 'Unsave' : 'Save'}
        >
          <Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} />
        </button>
      </div>
    </motion.article>
  )
}
