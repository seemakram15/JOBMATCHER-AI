import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { X, Plus } from 'lucide-react'
import { cn } from '../../lib/cn'

export type TagAccent = 'primary' | 'violet' | 'cyan' | 'success' | 'warning' | 'danger' | 'pink'

const ACCENT_CHIP: Record<TagAccent, string> = {
  primary: 'border-primary/30 bg-primary/12 text-primary',
  violet: 'border-violet/30 bg-violet/12 text-violet',
  cyan: 'border-cyan/30 bg-cyan/12 text-cyan',
  success: 'border-success/30 bg-success/12 text-success',
  warning: 'border-warning/30 bg-warning/12 text-warning',
  danger: 'border-danger/30 bg-danger/12 text-danger',
  pink: 'border-pink/30 bg-pink/12 text-pink',
}

interface TagInputProps {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  accent?: TagAccent
  max?: number
  icon?: ReactNode
  ariaLabel?: string
}

/** Chip-style multi-value input: type + Enter/comma to add, click ✕ or Backspace to remove. */
export function TagInput({
  value,
  onChange,
  placeholder = 'Type and press Enter',
  accent = 'primary',
  max = 30,
  icon,
  ariaLabel,
}: TagInputProps) {
  const [draft, setDraft] = useState('')

  const addTokens = (raw: string) => {
    const parts = raw
      .split(/[,\n]/)
      .map((part) => part.trim())
      .filter(Boolean)
    if (!parts.length) return
    const next = [...value]
    for (const part of parts) {
      if (next.length >= max) break
      if (!next.some((item) => item.toLowerCase() === part.toLowerCase())) next.push(part)
    }
    onChange(next)
    setDraft('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTokens(draft)
    } else if (event.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  const remove = (tag: string) => onChange(value.filter((item) => item !== tag))

  return (
    <div
      className="mt-2 flex min-h-11 flex-wrap items-center gap-2 rounded-xl border border-line bg-bg/70 p-2 transition focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgb(var(--color-primary)/0.16)]"
      role="group"
      aria-label={ariaLabel}
    >
      {icon ? <span className="ml-1 text-muted">{icon}</span> : null}
      {value.map((tag) => (
        <span
          key={tag}
          className={cn('group inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-sm font-medium', ACCENT_CHIP[accent])}
        >
          {tag}
          <button
            type="button"
            onClick={() => remove(tag)}
            className="rounded-full p-0.5 opacity-70 transition hover:bg-black/10 hover:opacity-100"
            aria-label={`Remove ${tag}`}
          >
            <X size={13} />
          </button>
        </span>
      ))}
      <div className="flex min-w-[8rem] flex-1 items-center gap-1">
        <input
          className="h-8 w-full min-w-0 bg-transparent px-1 text-sm text-ink outline-none placeholder:text-muted"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => addTokens(draft)}
          placeholder={value.length ? '' : placeholder}
        />
        {draft.trim() ? (
          <button
            type="button"
            onClick={() => addTokens(draft)}
            className="shrink-0 rounded-lg border border-line p-1 text-muted transition hover:border-primary hover:text-primary"
            aria-label="Add"
          >
            <Plus size={14} />
          </button>
        ) : null}
      </div>
    </div>
  )
}
