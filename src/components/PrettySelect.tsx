import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'

export interface PrettySelectOption<T extends string = string> {
  value: T
  label: string
  detail?: string
  disabled?: boolean
}

interface PrettySelectProps<T extends string = string> {
  value: T
  options: PrettySelectOption<T>[]
  onChange: (value: T) => void
  ariaLabel: string
  placeholder?: string
  icon?: ReactNode
  className?: string
}

export function PrettySelect<T extends string = string>({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = 'Select',
  icon,
  className = '',
}: PrettySelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const id = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const selected = useMemo(() => options.find((option) => option.value === value), [options, value])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const selectOption = (option: PrettySelectOption<T>) => {
    if (option.disabled) return
    onChange(option.value)
    setIsOpen(false)
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        className={`group flex h-11 w-full items-center gap-2 rounded-md border border-line bg-bg/80 px-3 text-left text-sm font-medium text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] transition hover:border-primary/60 hover:bg-primary/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${
          isOpen ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : ''
        }`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={id}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setIsOpen(true)
          }
        }}
      >
        {icon ? <span className="flex h-5 w-5 shrink-0 items-center justify-center text-muted group-hover:text-primary">{icon}</span> : null}
        <span className="min-w-0 flex-1 truncate">{selected?.label || placeholder}</span>
        <span className="h-6 w-px bg-line" />
        <ChevronDown
          size={16}
          className={`shrink-0 text-muted transition group-hover:text-primary ${isOpen ? 'rotate-180 text-primary' : ''}`}
        />
      </button>

      {isOpen ? (
        <div
          id={id}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-md border border-line bg-panel shadow-[0_18px_50px_rgb(0_0_0/0.28)]"
        >
          <div className="max-h-64 overflow-y-auto p-1">
            {options.map((option) => {
              const isSelected = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={option.disabled}
                  className={`flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    isSelected
                      ? 'bg-primary/15 text-primary'
                      : 'text-ink hover:bg-primary/10 hover:text-primary'
                  }`}
                  onClick={() => selectOption(option)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{option.label}</span>
                    {option.detail ? <span className="mt-0.5 block truncate text-xs text-muted">{option.detail}</span> : null}
                  </span>
                  {isSelected ? <Check size={16} className="shrink-0" /> : null}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
