import { KIT_INTENSITIES, intensityLabel, type KitIntensity } from '@/lib/kit-intensity'
import { activateOnPointer, cn } from '@/lib/utils'

export function KitIntensityControl({
  value,
  onChange,
}: {
  value: KitIntensity
  onChange: (next: KitIntensity) => void
}) {
  return (
    <div
      data-section="kit-intensity"
      data-kit-intensity={value}
      data-intensity-count={KIT_INTENSITIES.length}
      className="mt-2.5 rounded-2xl border border-white/10 bg-[#141A28]/80 px-3 py-2"
    >
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">Intensity</p>
      <div role="radiogroup" aria-label="Kit intensity" className="mt-1.5 flex gap-1">
        {KIT_INTENSITIES.map((step) => (
          <button
            key={step}
            type="button"
            role="radio"
            aria-checked={value === step}
            aria-label={intensityLabel(step)}
            data-intensity={step}
            {...activateOnPointer(() => onChange(step))}
            className={cn(
              'h-8 flex-1 touch-manipulation rounded-lg font-serif text-sm italic leading-none',
              value === step
                ? 'bg-[#A855F7] text-white'
                : 'border border-white/10 bg-white/4 text-slate-300 hover:border-[#A855F7]/50',
            )}
          >
            {intensityLabel(step)}
          </button>
        ))}
      </div>
    </div>
  )
}
