import { Banknote, Briefcase, Clock, Layers3, RotateCcw, SlidersHorizontal } from 'lucide-react'
import type { ExperienceLevel, JobFilters, JobType, WorkMode } from '../types'
import { PrettySelect } from './PrettySelect'

interface FilterPanelProps {
  filters: JobFilters
  sources: string[]
  onChange: (filters: Partial<JobFilters>) => void
  onReset: () => void
}

const workModes: { value: WorkMode; label: string }[] = [
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
]

const jobTypes: { value: JobType; label: string }[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'internship', label: 'Internship' },
]

const levels: { value: ExperienceLevel; label: string }[] = [
  { value: 'entry', label: 'Entry' },
  { value: 'mid', label: 'Mid' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead' },
]

const datePostedOptions: { value: JobFilters['datePosted']; label: string }[] = [
  { value: 'any', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: '3days', label: 'Last 3 days' },
  { value: 'week', label: 'Last week' },
  { value: 'month', label: 'Last month' },
]

function toggleValue<T extends string>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
        active ? 'border-cyan bg-cyan/15 text-cyan' : 'border-line bg-bg/60 text-muted hover:border-cyan/40 hover:text-ink'
      }`}
    >
      {label}
    </button>
  )
}

function Group({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        {icon}
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

export function FilterPanel({ filters, sources, onChange, onReset }: FilterPanelProps) {
  return (
    <div className="panel p-5">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan/15 text-cyan">
            <SlidersHorizontal size={17} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Filters</p>
            <p className="text-xs text-muted">Narrow your matches</p>
          </div>
        </div>
        <button className="secondary-button h-9 text-xs" onClick={onReset}>
          <RotateCcw size={14} /> Reset
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted">
            <span>Minimum match score</span>
            <span className="font-mono text-cyan">{filters.scoreMin}%</span>
          </div>
          <input
            className="skill-range mt-3 w-full"
            type="range"
            min={0}
            max={100}
            step={5}
            value={filters.scoreMin}
            onChange={(event) => onChange({ scoreMin: Number(event.target.value) })}
            style={{ ['--rank' as string]: `${filters.scoreMin}%` }}
            aria-label="Minimum match score"
          />
        </div>

        <Group label="Work mode" icon={<Layers3 size={13} />}>
          {workModes.map((option) => (
            <Chip
              key={option.value}
              active={filters.workModes.includes(option.value)}
              label={option.label}
              onClick={() => onChange({ workModes: toggleValue(filters.workModes, option.value) })}
            />
          ))}
        </Group>

        <Group label="Job type" icon={<Briefcase size={13} />}>
          {jobTypes.map((option) => (
            <Chip
              key={option.value}
              active={filters.jobTypes.includes(option.value)}
              label={option.label}
              onClick={() => onChange({ jobTypes: toggleValue(filters.jobTypes, option.value) })}
            />
          ))}
        </Group>

        <Group label="Experience level" icon={<SlidersHorizontal size={13} />}>
          {levels.map((option) => (
            <Chip
              key={option.value}
              active={filters.levels.includes(option.value)}
              label={option.label}
              onClick={() => onChange({ levels: toggleValue(filters.levels, option.value) })}
            />
          ))}
        </Group>

        <label className="field-label">
          Source
          <PrettySelect
            className="mt-2"
            value={filters.sources[0] ?? ''}
            options={[{ value: '', label: 'All sources' }, ...sources.map((source) => ({ value: source, label: source }))]}
            onChange={(source) => onChange({ sources: source ? [source] : [] })}
            ariaLabel="Source platform"
          />
        </label>

        <label className="field-label">
          Date posted
          <PrettySelect
            className="mt-2"
            value={filters.datePosted}
            options={datePostedOptions}
            onChange={(datePosted) => onChange({ datePosted })}
            ariaLabel="Date posted"
            icon={<Clock size={15} />}
          />
        </label>

        <label className="field-label">
          Minimum salary
          <span className="field-shell normal-case">
            <Banknote size={15} className="text-success" />
            <input
              type="number"
              min={0}
              step={5000}
              value={filters.salaryMin || ''}
              onChange={(event) => onChange({ salaryMin: Math.max(0, Number(event.target.value) || 0) })}
              placeholder="Any salary"
              aria-label="Minimum salary"
            />
          </span>
        </label>
      </div>
    </div>
  )
}
