import { BriefcaseBusiness, DollarSign, Layers3, RotateCcw, Search, SlidersHorizontal } from 'lucide-react'
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
  { value: '3days', label: '3 days' },
  { value: 'week', label: 'Last week' },
  { value: 'month', label: 'Last month' },
]

const sortOptions: { value: JobFilters['sort']; label: string }[] = [
  { value: 'score', label: 'Score' },
  { value: 'date', label: 'Date' },
  { value: 'salary', label: 'Salary' },
  { value: 'company', label: 'Company' },
]

function toggleValue<T extends string>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

export function FilterPanel({ filters, sources, onChange, onReset }: FilterPanelProps) {
  return (
    <aside className="panel p-4 lg:sticky lg:top-4">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary">
            <SlidersHorizontal size={17} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Filters</p>
            <p className="text-xs text-muted">Narrow by fit</p>
          </div>
        </div>
        <button className="icon-button" onClick={onReset} aria-label="Reset filters" title="Reset filters">
          <RotateCcw size={15} />
        </button>
      </div>

      <label className="field-label" htmlFor="search">
        Search
      </label>
      <div className="field-shell">
        <Search size={15} className="text-muted" />
        <input
          id="search"
          value={filters.search}
          onChange={(event) => onChange({ search: event.target.value })}
          placeholder="Title, company, skill"
        />
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs font-medium uppercase text-muted">
          <span>Minimum score</span>
          <span className="font-mono text-primary">{filters.scoreMin}%</span>
        </div>
        <input
          className="mt-3 w-full accent-primary"
          type="range"
          min={0}
          max={100}
          step={5}
          value={filters.scoreMin}
          onChange={(event) => onChange({ scoreMin: Number(event.target.value) })}
          aria-label="Minimum match score"
        />
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase text-muted">
          <span>Minimum salary</span>
          <span className="font-mono text-primary">{filters.salaryMin ? `$${Math.round(filters.salaryMin / 1000)}k` : 'Any'}</span>
        </div>
        <div className="field-shell">
          <DollarSign size={15} className="text-muted" />
          <input
            type="number"
            min={0}
            step={5000}
            value={filters.salaryMin || ''}
            onChange={(event) => onChange({ salaryMin: Math.max(0, Number(event.target.value) || 0) })}
            placeholder="Any salary"
            aria-label="Minimum salary"
          />
        </div>
      </div>

      <FilterGroup title="Work mode" icon={<Layers3 size={14} />}>
        {workModes.map((option) => (
          <label key={option.value} className="flex items-center gap-2 rounded-md border border-line bg-bg/55 px-3 py-2 text-sm text-ink transition hover:border-primary/60">
            <input
              type="checkbox"
              className="accent-primary"
              checked={filters.workModes.includes(option.value)}
              onChange={() => onChange({ workModes: toggleValue(filters.workModes, option.value) })}
            />
            {option.label}
          </label>
        ))}
      </FilterGroup>

      <FilterGroup title="Job type" icon={<BriefcaseBusiness size={14} />}>
        {jobTypes.map((option) => (
          <label key={option.value} className="flex items-center gap-2 rounded-md border border-line bg-bg/55 px-3 py-2 text-sm text-ink transition hover:border-primary/60">
            <input
              type="checkbox"
              className="accent-primary"
              checked={filters.jobTypes.includes(option.value)}
              onChange={() => onChange({ jobTypes: toggleValue(filters.jobTypes, option.value) })}
            />
            {option.label}
          </label>
        ))}
      </FilterGroup>

      <FilterGroup title="Level" icon={<SlidersHorizontal size={14} />}>
        <div className="grid grid-cols-2 gap-2">
          {levels.map((option) => (
            <button
              key={option.value}
              className={`rounded-md border px-3 py-2 text-sm transition ${
                filters.levels.includes(option.value)
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-line bg-bg/70 text-muted hover:text-ink'
              }`}
              onClick={() => onChange({ levels: toggleValue(filters.levels, option.value) })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Source" icon={<Search size={14} />}>
        <PrettySelect
          value={filters.sources[0] ?? ''}
          options={[
            { value: '', label: 'All sources' },
            ...sources.map((source) => ({ value: source, label: source })),
          ]}
          onChange={(source) => onChange({ sources: source ? [source] : [] })}
          ariaLabel="Source platform"
        />
      </FilterGroup>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <label className="field-label">
          Date
          <PrettySelect
            className="mt-2"
            value={filters.datePosted}
            options={datePostedOptions}
            onChange={(datePosted) => onChange({ datePosted })}
            ariaLabel="Date posted"
          />
        </label>
        <label className="field-label">
          Sort
          <PrettySelect
            className="mt-2"
            value={filters.sort}
            options={sortOptions}
            onChange={(sort) => onChange({ sort })}
            ariaLabel="Sort jobs"
          />
        </label>
      </div>
    </aside>
  )
}

function FilterGroup({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase text-muted">
        {icon}
        {title}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  )
}
