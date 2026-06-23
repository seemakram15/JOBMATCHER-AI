import { useMemo, useState } from 'react'
import { DndContext, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { BriefcaseBusiness, CalendarClock, ExternalLink, GripVertical, MapPin, X } from 'lucide-react'
import type { Application, ApplicationStatus, ScoredJob } from '../types'
import { ScoreBadge } from './ScoreBadge'

interface KanbanBoardProps {
  applications: Application[]
  scoredJobs: ScoredJob[]
  onMove: (applicationId: string, status: ApplicationStatus) => void
}

const columns: { status: ApplicationStatus; title: string }[] = [
  { status: 'saved', title: 'Saved' },
  { status: 'applied', title: 'Applied' },
  { status: 'interviewing', title: 'Interviewing' },
  { status: 'offer', title: 'Offer' },
  { status: 'rejected', title: 'Rejected' },
  { status: 'withdrawn', title: 'Withdrawn' },
]

const statusOptions = columns

export function KanbanBoard({ applications, scoredJobs, onMove }: KanbanBoardProps) {
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null)
  const selectedApplication = applications.find((application) => application.id === selectedApplicationId)
  const selectedScoredJob = selectedApplication
    ? scoredJobs.find(({ job }) => job.id === selectedApplication.jobId)
    : undefined

  const scoredJobById = useMemo(
    () => new Map(scoredJobs.map((scoredJob) => [scoredJob.job.id, scoredJob])),
    [scoredJobs],
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const destination = event.over?.id as ApplicationStatus | undefined
    if (destination && columns.some((column) => column.status === destination)) {
      onMove(String(event.active.id), destination)
    }
  }

  return (
    <>
      <DndContext onDragEnd={handleDragEnd}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {columns.map((column) => {
            const items = applications.filter((application) => application.status === column.status)
            return (
              <KanbanColumn key={column.status} status={column.status} title={column.title} count={items.length}>
                {items.map((application) => {
                  const scoredJob = scoredJobById.get(application.jobId)
                  return scoredJob ? (
                    <ApplicationCard
                      key={application.id}
                      application={application}
                      scoredJob={scoredJob}
                      onOpen={() => setSelectedApplicationId(application.id)}
                    />
                  ) : null
                })}
              </KanbanColumn>
            )
          })}
        </div>
      </DndContext>

      {selectedApplication && selectedScoredJob ? (
        <ApplicationModal
          application={selectedApplication}
          scoredJob={selectedScoredJob}
          onClose={() => setSelectedApplicationId(null)}
          onStatusChange={(status) => onMove(selectedApplication.id, status)}
        />
      ) : null}
    </>
  )
}

function KanbanColumn({
  status,
  title,
  count,
  children,
}: {
  status: ApplicationStatus
  title: string
  count: number
  children: React.ReactNode
}) {
  const { isOver, setNodeRef } = useDroppable({ id: status })

  return (
    <section
      ref={setNodeRef}
      className={`min-h-[360px] rounded-md border p-3 transition ${
        isOver ? 'border-primary bg-primary/10' : 'border-line bg-panel/80'
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <span className="rounded-md border border-line bg-bg px-2 py-1 font-mono text-xs text-muted">{count}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function ApplicationCard({
  application,
  scoredJob,
  onOpen,
}: {
  application: Application
  scoredJob: ScoredJob
  onOpen: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: application.id })
  const style = {
    transform: CSS.Translate.toString(transform),
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`rounded-md border border-line bg-bg/80 p-3 shadow-lg transition hover:border-primary ${
        isDragging ? 'opacity-70' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <button
          className="mt-1 text-muted hover:text-ink"
          aria-label={`Move ${scoredJob.job.title}`}
          title="Move"
          {...listeners}
          {...attributes}
        >
          <GripVertical size={16} />
        </button>
        <button className="min-w-0 flex-1 text-left" onClick={onOpen}>
          <p className="truncate text-xs text-muted">{scoredJob.job.company}</p>
          <h4 className="mt-1 line-clamp-2 text-sm font-semibold text-ink">{scoredJob.job.title}</h4>
        </button>
        <ScoreBadge score={scoredJob.match.totalScore} size="sm" />
      </div>
      <button className="mt-3 block w-full text-left" onClick={onOpen}>
        <p className="line-clamp-3 text-xs leading-5 text-muted">{application.notes}</p>
        {application.reminderDate ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-warning">
            <CalendarClock size={13} />
            {application.reminderDate}
          </div>
        ) : null}
      </button>
    </article>
  )
}

function ApplicationModal({
  application,
  scoredJob,
  onClose,
  onStatusChange,
}: {
  application: Application
  scoredJob: ScoredJob
  onClose: () => void
  onStatusChange: (status: ApplicationStatus) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-md border border-line bg-panel shadow-soft">
        <div className="flex items-start justify-between gap-4 border-b border-line p-5">
          <div>
            <p className="text-sm text-muted">{scoredJob.job.company}</p>
            <h2 className="mt-1 text-2xl font-bold text-ink">{scoredJob.job.title}</h2>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted">
              <span className="inline-flex items-center gap-1">
                <MapPin size={15} /> {scoredJob.job.location}
              </span>
              <span className="inline-flex items-center gap-1">
                <BriefcaseBusiness size={15} /> {scoredJob.job.jobType.replace('_', ' ')}
              </span>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close application details" title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_220px]">
          <div className="space-y-5">
            <div className="rounded-md border border-line bg-bg/60 p-4">
              <p className="text-sm font-semibold text-ink">Application notes</p>
              <p className="mt-2 text-sm leading-6 text-muted">{application.notes || 'No notes yet.'}</p>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-ink">Job details</p>
              <p className="text-sm leading-7 text-muted">{scoredJob.job.description}</p>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-ink">Matched skills</p>
              <div className="flex flex-wrap gap-2">
                {scoredJob.match.matchedSkills.map((skill) => (
                  <span key={skill} className="rounded-md border border-success/30 bg-success/10 px-2 py-1 text-xs text-success">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="flex justify-center">
              <ScoreBadge score={scoredJob.match.totalScore} size="lg" />
            </div>
            <label className="block text-xs font-medium uppercase text-muted">
              Status
              <select
                className="control mt-2 h-11 w-full rounded-md px-3 text-sm normal-case"
                value={application.status}
                onChange={(event) => onStatusChange(event.target.value as ApplicationStatus)}
              >
                {statusOptions.map((option) => (
                  <option key={option.status} value={option.status}>
                    {option.title}
                  </option>
                ))}
              </select>
            </label>
            <a
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white"
              href={scoredJob.job.applyUrl}
              target="_blank"
              rel="noreferrer"
            >
              Source listing <ExternalLink size={16} />
            </a>
          </aside>
        </div>
      </section>
    </div>
  )
}
