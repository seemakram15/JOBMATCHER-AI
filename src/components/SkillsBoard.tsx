import { useState } from 'react'
import { Check, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react'
import type { CvSkill } from '../types'
import { cn } from '../lib/cn'

interface SkillsBoardProps {
  skills: CvSkill[]
  readOnly?: boolean
  onAdd: (name: string, rank: number) => void
  onUpdate: (next: CvSkill, previousCanonical: string) => void
  onRemove: (canonical: string) => void
}

const TYPE_LABEL: Record<CvSkill['skillType'], string> = {
  technical: 'Technical',
  soft: 'Soft skill',
  language: 'Language',
  tool: 'Tool',
  framework: 'Framework',
  certification: 'Certificate',
}

function confidenceOf(rank: number): CvSkill['confidence'] {
  if (rank >= 78) return 'high'
  if (rank >= 45) return 'medium'
  return 'low'
}

const BAR_COLOR: Record<CvSkill['confidence'], string> = {
  high: 'bg-success',
  medium: 'bg-cyan',
  low: 'bg-warning',
}

const CONF_LABEL: Record<CvSkill['confidence'], string> = {
  high: 'Strong',
  medium: 'Good',
  low: 'Learning',
}

export function SkillsBoard({ skills, readOnly = false, onAdd, onUpdate, onRemove }: SkillsBoardProps) {
  const [newName, setNewName] = useState('')
  const [newRank, setNewRank] = useState(70)
  const [editKey, setEditKey] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editRank, setEditRank] = useState(70)

  const sorted = [...skills].sort((a, b) => (b.skillRank || 0) - (a.skillRank || 0))

  const submitNew = () => {
    const name = newName.trim()
    if (!name) return
    onAdd(name, newRank)
    setNewName('')
    setNewRank(70)
  }

  const startEdit = (skill: CvSkill) => {
    setEditKey(skill.skillCanonical)
    setEditName(skill.skillName)
    setEditRank(skill.skillRank || 0)
  }

  const saveEdit = (skill: CvSkill) => {
    const name = editName.trim() || skill.skillName
    onUpdate(
      {
        ...skill,
        skillName: name,
        skillCanonical: name,
        skillRank: editRank,
        confidence: confidenceOf(editRank),
      },
      skill.skillCanonical,
    )
    setEditKey(null)
  }

  return (
    <div>
      {!readOnly ? (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-line bg-bg/50 p-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-bg/70 px-3">
            <Sparkles size={16} className="text-primary" />
            <input
              className="h-10 w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && submitNew()}
              placeholder="Add a skill (e.g. React, Figma, SQL)"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={newRank}
              onChange={(event) => setNewRank(Number(event.target.value))}
              className="skill-range w-32"
              style={{ ['--rank' as string]: `${newRank}%` }}
              aria-label="New skill proficiency"
            />
            <span className="w-10 text-right font-mono text-sm font-semibold text-ink">{newRank}%</span>
            <button type="button" onClick={submitNew} className="primary-button h-10 shrink-0 rounded-xl">
              <Plus size={16} /> Add
            </button>
          </div>
        </div>
      ) : null}

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-bg/40 p-8 text-center text-sm text-muted">
          No skills yet. Upload a CV or add skills above to start matching jobs.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sorted.map((skill) => {
            const conf = confidenceOf(skill.skillRank || 0)
            const isEditing = editKey === skill.skillCanonical
            return (
              <div
                key={skill.skillCanonical}
                className="group relative rounded-2xl border border-line bg-panel/70 p-4 transition-colors hover:border-primary/40"
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <input
                      className="h-9 w-full rounded-lg border border-line bg-bg/70 px-3 text-sm text-ink outline-none focus:border-primary"
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      placeholder="Skill name"
                    />
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={editRank}
                        onChange={(event) => setEditRank(Number(event.target.value))}
                        className="skill-range flex-1"
                        style={{ ['--rank' as string]: `${editRank}%` }}
                        aria-label={`${skill.skillName} proficiency`}
                      />
                      <span className="w-10 text-right font-mono text-sm font-semibold text-ink">{editRank}%</span>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => saveEdit(skill)} className="primary-button h-9 flex-1 rounded-lg text-xs">
                        <Check size={14} /> Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditKey(null)}
                        className="secondary-button h-9 rounded-lg px-3 text-xs"
                      >
                        <X size={14} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{skill.skillName}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-md border border-line bg-bg/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                            {TYPE_LABEL[skill.skillType] ?? 'Skill'}
                          </span>
                          {skill.isManual ? (
                            <span className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              Manual
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg font-bold text-ink">{skill.skillRank || 0}%</span>
                        {!readOnly ? (
                          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => startEdit(skill)}
                              className="rounded-lg border border-line p-1.5 text-muted transition hover:border-primary hover:text-primary"
                              aria-label={`Edit ${skill.skillName}`}
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onRemove(skill.skillCanonical)}
                              className="rounded-lg border border-line p-1.5 text-muted transition hover:border-danger hover:text-danger"
                              aria-label={`Remove ${skill.skillName}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                        <div
                          className={cn('h-full rounded-full transition-all', BAR_COLOR[conf])}
                          style={{ width: `${Math.min(Math.max(skill.skillRank || 0, 0), 100)}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-medium text-muted">{CONF_LABEL[conf]}</span>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
