import {
  INTENSITY_MARK_LABELS,
  INTENSITY_MARKS,
  intensityFromMark,
  intensityMark,
  type KitIntensity,
} from '@/lib/kit-intensity'
import { activateOnPointer, cn } from '@/lib/utils'

export function IntensitySwitch({
  value,
  onChange,
  compact = false,
}: {
  value: KitIntensity
  onChange: (next: KitIntensity) => void
  compact?: boolean
}) {
  const mark = intensityMark(value)
  return (
    <div
      role="group"
      aria-label="Playing intensity"
      data-section="kit-intensity"
      data-intensity-switch
      data-kit-intensity={value}
      data-intensity-mark={mark}
      className={cn(
        'grid grid-cols-2 rounded-full border border-white/12 bg-white/4 p-0.5',
        compact ? 'h-9 min-w-[10.5rem]' : 'h-10',
      )}
    >
      {INTENSITY_MARKS.map((id) => {
        const on = mark === id
        return (
          <button
            key={id}
            type="button"
            data-intensity={id}
            aria-pressed={on}
            {...activateOnPointer(() => onChange(intensityFromMark(id)))}
            className={cn(
              'rounded-full text-[0.68rem] font-semibold tracking-wide',
              compact && 'text-[0.62rem]',
              on ? 'bg-[#A855F7] text-white' : 'text-slate-300',
            )}
          >
            {INTENSITY_MARK_LABELS[id]}
          </button>
        )
      })}
    </div>
  )
}
