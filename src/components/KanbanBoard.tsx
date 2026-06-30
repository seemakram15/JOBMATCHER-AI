import { useMemo, useState } from 'react'
import { DndContext, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { BriefcaseBusiness, CalendarClock, ExternalLink, GripVertical, MapPin, X } from 'lucide-react'
import type { Application, ApplicationStatus, ScoredJob } from '../types'
import { PrettySelect } from './PrettySelect'
import { ScoreBadge } from './ScoreBadge'

interface KanbanBoardProps {
  applications: Application[]
  scoredJobs: ScoredJob[]
  onMove: (applicationId: string, status: ApplicationStatus) => void
  readOnly?: boolean
}

const STATUS_META: Record<ApplicationStatus, { title: string; dot: string; top: string }> = {
  saved: { title: 'Saved', dot: 'bg-muted', top: 'border-t-muted/50' },
  applied: { title: 'Applied', dot: 'bg-primary', top: 'border-t-primary' },
  interviewing: { title: 'Interviewing', dot: 'bg-warning', top: 'border-t-warning' },
  offer: { title: 'Offer', dot: 'bg-success', top: 'border-t-success' },
  rejected: { title: 'Rejected', dot: 'bg-danger', top: 'border-t-danger' },
  withdrawn: { title: 'Withdrawn', dot: 'bg-muted', top: 'border-t-muted/50' },
  archived: { title: 'Archived', dot: 'bg-muted', top: 'border-t-muted/50' },
}

const columns: ApplicationStatus[] = ['saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn']

export function KanbanBoard({ applications, scoredJobs, onMove, readOnly = false }: KanbanBoardProps) {
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
    if (readOnly) return
    const destination = event.over?.id as ApplicationStatus | undefined
    if (destination && columns.includes(destination)) {
      onMove(String(event.active.id), destination)
    }
  }

  return (
    <>
      <DndContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-3">
          {columns.map((status) => {
            const items = applications.filter((application) => application.status === status)
            return (
              <KanbanColumn key={status} status={status} count={items.length} readOnly={readOnly}>
                {items.map((application) => {
                  const scoredJob = scoredJobById.get(application.jobId)
                  return scoredJob ? (
                    <ApplicationCard
                      key={application.id}
                      application={application}
                      scoredJob={scoredJob}
                      readOnly={readOnly}
                      onOpen={() => setSelectedApplicationId(application.id)}
                    />
                  ) : null
                })}
                {items.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-line bg-bg/40 p-4 text-center text-xs text-muted">
                    Nothing here yet
                  </p>
                ) : null}
              </KanbanColumn>
            )
          })}
        </div>
      </DndContext>

      {selectedApplication && selectedScoredJob ? (
        <ApplicationModal
          application={selectedApplication}
          scoredJob={selectedScoredJob}
          readOnly={readOnly}
          onClose={() => setSelectedApplicationId(null)}
          onStatusChange={(status) => onMove(selectedApplication.id, status)}
        />
      ) : null}
    </>
  )
}

function KanbanColumn({
  status,
  count,
  readOnly,
  children,
}: {
  status: ApplicationStatus
  count: number
  readOnly: boolean
  children: React.ReactNode
}) {
  const { isOver, setNodeRef } = useDroppable({ id: status, disabled: readOnly })
  const meta = STATUS_META[status]

  return (
    <section
      ref={setNodeRef}
      className={`flex max-h-[70vh] w-72 shrink-0 flex-col rounded-2xl border border-t-4 ${meta.top} p-3 transition ${
        isOver ? 'border-primary bg-primary/5' : 'border-line bg-panel/70'
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
          {meta.title}
        </h3>
        <span className="rounded-full border border-line bg-bg px-2 py-0.5 font-mono text-xs text-muted">{count}</span>
      </div>
      <div className="space-y-3 overflow-y-auto">{children}</div>
    </section>
  )
}

function ApplicationCard({
  application,
  scoredJob,
  readOnly,
  onOpen,
}: {
  application: Application
  scoredJob: ScoredJob
  readOnly: boolean
  onOpen: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: application.id, disabled: readOnly })
  const style = { transform: CSS.Translate.toString(transform) }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-line bg-bg/70 p-3 transition hover:border-primary/50 ${isDragging ? 'opacity-70 shadow-glow' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        {!readOnly ? (
          <button
            className="mt-0.5 cursor-grab text-muted hover:text-ink active:cursor-grabbing"
            aria-label={`Move ${scoredJob.job.title}`}
            title="Drag to move"
            {...listeners}
            {...attributes}
          >
            <GripVertical size={16} />
          </button>
        ) : null}
        <button className="min-w-0 flex-1 text-left" onClick={onOpen}>
          <p className="truncate text-xs text-muted">{scoredJob.job.company}</p>
          <h4 className="mt-1 line-clamp-2 text-sm font-semibold text-ink">{scoredJob.job.title}</h4>
        </button>
        <ScoreBadge score={scoredJob.match.totalScore} size="sm" />
      </div>
      <button className="mt-3 block w-full text-left" onClick={onOpen}>
        {application.notes ? <p className="line-clamp-2 text-xs leading-5 text-muted">{application.notes}</p> : null}
        {application.reminderDate ? (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-warning/10 px-2 py-1 text-xs text-warning">
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
  readOnly,
  onClose,
  onStatusChange,
}: {
  application: Application
  scoredJob: ScoredJob
  readOnly: boolean
  onClose: () => void
  onStatusChange: (status: ApplicationStatus) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-line bg-panel shadow-soft">
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
            <div className="rounded-xl border border-line bg-bg/60 p-4">
              <p className="text-sm font-semibold text-ink">Notes</p>
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
                  <span key={skill} className="rounded-lg border border-success/30 bg-success/10 px-2 py-1 text-xs text-success">
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
            {readOnly ? (
              <div className="rounded-xl border border-line bg-bg/60 p-3 text-center">
                <p className="text-xs uppercase tracking-wide text-muted">Status</p>
                <p className="mt-1 font-semibold text-ink">{STATUS_META[application.status].title}</p>
              </div>
            ) : (
              <label className="block text-xs font-medium uppercase text-muted">
                Status
                <PrettySelect<ApplicationStatus>
                  className="mt-2 normal-case"
                  value={application.status}
                  options={columns.map((status) => ({ value: status, label: STATUS_META[status].title }))}
                  onChange={onStatusChange}
                  ariaLabel="Application status"
                />
              </label>
            )}
            <a
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/90"
              href={scoredJob.job.applyUrl}
              target="_blank"
              rel="noreferrer"
            >
              View listing <ExternalLink size={16} />
            </a>
          </aside>
        </div>
      </section>
    </div>
  )
}
