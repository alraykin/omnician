import type { TunerDisplayMode } from '@/lib/custom-presets'
import { cn } from '@/lib/utils'

type TunerDisplayToggleProps = {
  mode: TunerDisplayMode
  onChange: (mode: TunerDisplayMode) => void
}

const MODES: ReadonlyArray<{ id: TunerDisplayMode; label: string }> = [
  { id: 'strobe', label: 'Strobe' },
  { id: 'target', label: 'Target' },
]

export function TunerDisplayToggle({ mode, onChange }: TunerDisplayToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Tuner display"
      data-display-toggle
      className="grid grid-cols-2 rounded-full bg-white/6 p-1 ring-1 ring-white/10"
    >
      {MODES.map((item) => {
        const selected = item.id === mode
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={selected}
            data-display-mode={item.id}
            onClick={() => onChange(item.id)}
            className={cn(
              'h-9 rounded-full text-sm font-semibold transition-colors',
              selected
                ? 'bg-[#A855F7] text-white shadow-[0_0_18px_rgba(168,85,247,0.35)]'
                : 'text-slate-400 hover:text-white',
            )}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
