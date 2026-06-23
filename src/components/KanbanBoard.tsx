import { DndContext, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { CalendarClock, GripVertical } from 'lucide-react'
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
  { status: 'phone_screen', title: 'Phone Screen' },
  { status: 'interviewing', title: 'Interviewing' },
  { status: 'offer', title: 'Offer' },
  { status: 'rejected', title: 'Rejected' },
  { status: 'withdrawn', title: 'Withdrawn' },
]

const closedStatuses: ApplicationStatus[] = ['offer', 'rejected', 'withdrawn', 'archived']

export function KanbanBoard({ applications, scoredJobs, onMove }: KanbanBoardProps) {
  const handleDragEnd = (event: DragEndEvent) => {
    const destination = event.over?.id as ApplicationStatus | undefined
    if (destination && columns.some((column) => column.status === destination)) {
      onMove(String(event.active.id), destination)
    }
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="grid gap-4 overflow-x-auto pb-2 xl:grid-cols-7">
        {columns.map((column) => {
          const items = applications.filter((application) => application.status === column.status)
          return (
            <KanbanColumn key={column.status} status={column.status} title={column.title} count={items.length}>
              {items.map((application) => {
                const scoredJob = scoredJobs.find(({ job }) => job.id === application.jobId)
                return scoredJob ? (
                  <ApplicationCard key={application.id} application={application} scoredJob={scoredJob} />
                ) : null
              })}
            </KanbanColumn>
          )
        })}
      </div>
    </DndContext>
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
  const isClosed = closedStatuses.includes(status)

  return (
    <section
      ref={setNodeRef}
      className={`min-h-[220px] min-w-[260px] border p-3 transition ${
        isOver ? 'border-primary bg-primary/10' : 'border-line bg-panel/80'
      } ${isClosed ? 'opacity-80' : ''}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <span className="rounded-md border border-line bg-bg px-2 py-1 font-mono text-xs text-muted">{count}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function ApplicationCard({ application, scoredJob }: { application: Application; scoredJob: ScoredJob }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: application.id })
  const style = {
    transform: CSS.Translate.toString(transform),
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`border border-line bg-bg/80 p-3 shadow-lg transition ${isDragging ? 'opacity-70' : ''}`}
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
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted">{scoredJob.job.company}</p>
          <h4 className="mt-1 line-clamp-2 text-sm font-semibold text-ink">{scoredJob.job.title}</h4>
        </div>
        <ScoreBadge score={scoredJob.match.totalScore} size="sm" />
      </div>
      <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted">{application.notes}</p>
      {application.reminderDate ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-warning">
          <CalendarClock size={13} />
          {application.reminderDate}
        </div>
      ) : null}
    </article>
  )
}
