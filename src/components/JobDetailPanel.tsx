import DOMPurify from 'dompurify'
import { ArrowUpRight, Bookmark, CheckCircle2, ExternalLink, XCircle } from 'lucide-react'
import { ScoreBadge } from './ScoreBadge'
import type { ScoredJob } from '../types'

interface JobDetailPanelProps {
  scoredJob: ScoredJob
  onApply: () => void
  onToggleSave: () => void
}

export function JobDetailPanel({ scoredJob, onApply, onToggleSave }: JobDetailPanelProps) {
  const { job, match, isSaved } = scoredJob
  const cleanDescription = DOMPurify.sanitize(job.descriptionHtml)

  return (
    <section className="panel p-5 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{job.company}</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">{job.title}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs text-primary">
              {job.workMode}
            </span>
            <span className="rounded-md border border-line bg-bg/70 px-2 py-1 text-xs text-muted">{job.location}</span>
            <span className="rounded-md border border-line bg-bg/70 px-2 py-1 text-xs text-muted">{job.sourcePlatform}</span>
          </div>
        </div>
        <ScoreBadge score={match.totalScore} size="lg" />
      </div>

      <div className="mt-6 rounded-md border border-line bg-bg/60 p-4">
        <p className="text-sm font-semibold text-ink">Why this matches</p>
        <p className="mt-2 text-sm leading-6 text-muted">{match.matchSummary}</p>
      </div>

      <div className="mt-6 space-y-3">
        <ScoreRow label="Skill match" value={match.skillScore} max={50} />
        <ScoreRow label="Experience" value={match.experienceScore} max={20} />
        <ScoreRow label="Role title" value={match.titleScore} max={15} />
        <ScoreRow label="Location" value={match.locationScore} max={10} />
        <ScoreRow label="Freshness" value={match.recencyBonus} max={5} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-1">
        <SkillList
          title="Matched skills"
          icon={<CheckCircle2 size={16} />}
          tone="success"
          skills={match.matchedSkills}
          fallback="No direct matches yet"
        />
        <SkillList
          title="Skill gaps"
          icon={<XCircle size={16} />}
          tone="danger"
          skills={match.missingSkills}
          fallback="No required gaps"
        />
      </div>

      <div className="mt-6">
        <p className="mb-3 text-sm font-semibold text-ink">Description</p>
        <div
          className="prose prose-invert prose-sm max-w-none text-muted prose-li:marker:text-primary"
          dangerouslySetInnerHTML={{ __html: cleanDescription }}
        />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/90"
          onClick={onApply}
        >
          Apply now <ExternalLink size={16} />
        </button>
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line bg-bg/70 px-4 text-sm font-semibold text-ink transition hover:border-primary"
          onClick={onToggleSave}
        >
          <Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} />
          {isSaved ? 'Saved' : 'Save role'}
        </button>
      </div>

      <a
        className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80"
        href={job.applyUrl}
        target="_blank"
        rel="noreferrer"
      >
        Open source listing <ArrowUpRight size={15} />
      </a>
    </section>
  )
}

function ScoreRow({ label, value, max }: { label: string; value: number; max: number }) {
  const percent = Math.round((value / max) * 100)

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="font-mono text-ink">
          {value}/{max}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function SkillList({
  title,
  icon,
  tone,
  skills,
  fallback,
}: {
  title: string
  icon: React.ReactNode
  tone: 'success' | 'danger'
  skills: string[]
  fallback: string
}) {
  return (
    <div className="rounded-md border border-line bg-bg/60 p-4">
      <div className={`mb-3 flex items-center gap-2 text-sm font-semibold ${tone === 'success' ? 'text-success' : 'text-danger'}`}>
        {icon}
        {title}
      </div>
      <div className="flex flex-wrap gap-2">
        {(skills.length ? skills : [fallback]).map((skill) => (
          <span
            key={skill}
            className={`rounded-md border px-2 py-1 text-xs ${
              tone === 'success'
                ? 'border-success/30 bg-success/10 text-success'
                : 'border-danger/30 bg-danger/10 text-danger'
            }`}
          >
            {skill}
          </span>
        ))}
      </div>
    </div>
  )
}
