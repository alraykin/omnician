import { intensityLabel, styleIntensityProfile, type KitIntensity } from '@/lib/kit-intensity'
import type { RhythmStyleId } from '@/lib/rhythm-presets'
import { activateOnPointer, cn } from '@/lib/utils'

export function KitIntensityControl({
  styleId,
  value,
  onChange,
}: {
  styleId: RhythmStyleId
  value: KitIntensity
  onChange: (next: KitIntensity) => void
}) {
  const profile = styleIntensityProfile(styleId)
  return (
    <div
      data-section="kit-intensity"
      data-kit-intensity={value}
      data-kit-style={styleId}
      data-intensity-count={profile.levels.length}
      className="mt-2.5 rounded-2xl border border-white/10 bg-[#141A28]/80 px-3 py-2"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Intensity
        </p>
        <p className="min-w-0 text-right text-[0.65rem] font-semibold text-slate-400">
          {intensityLabel(styleId, value)}
        </p>
      </div>
      <div role="radiogroup" aria-label={`${profile.styleId} kit intensity`} className="mt-1.5 flex gap-1">
        {profile.levels.map((step) => (
          <button
            key={step}
            type="button"
            role="radio"
            aria-checked={value === step}
            aria-label={`${step}, ${intensityLabel(styleId, step)}`}
            data-intensity={step}
            {...activateOnPointer(() => onChange(step))}
            className={cn(
              'h-8 flex-1 touch-manipulation rounded-lg text-sm font-bold tabular-nums',
              value === step
                ? 'bg-[#A855F7] text-white'
                : 'border border-white/10 bg-white/4 text-slate-300 hover:border-[#A855F7]/50',
            )}
          >
            {step}
          </button>
        ))}
      </div>
    </div>
  )
}
