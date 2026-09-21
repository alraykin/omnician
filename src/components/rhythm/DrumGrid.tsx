import { VOICE_LABELS, VOICES, type Pattern, type VoiceId } from '@/lib/rhythm'
import { cn } from '@/lib/utils'

type DrumGridProps = {
  beats: number
  subdivisionSteps: number
  pattern: Pattern
  currentStep: number
  live: boolean
  onToggle: (voice: VoiceId, step: number) => void
  onPreview: (voice: VoiceId) => void
}

export function DrumGrid({
  beats,
  subdivisionSteps,
  pattern,
  currentStep,
  live,
  onToggle,
  onPreview,
}: DrumGridProps) {
  const steps = pattern.kick.length
  const minCell = subdivisionSteps >= 6 ? '1.25rem' : subdivisionSteps >= 4 ? '1.4rem' : '1.55rem'

  return (
    <div className="max-h-[min(58vh,34rem)] overflow-x-auto overflow-y-auto pb-1">
      <div
        className="min-w-full"
        style={{ minWidth: `calc(4.9rem + ${beats} * ${subdivisionSteps} * ${minCell})` }}
      >
        <div className="mb-1.5 flex items-center gap-1 pl-[4.9rem] text-[0.6rem] font-semibold uppercase tracking-wider text-slate-500">
          {Array.from({ length: beats }, (_, beat) => (
            <span
              key={`beat-${beat}`}
              className="text-center"
              style={{ flex: subdivisionSteps, minWidth: `calc(${subdivisionSteps} * ${minCell})` }}
            >
              {beat + 1}
            </span>
          ))}
        </div>

        <div className="space-y-0.5">
          {VOICES.map((voice) => (
            <div key={voice} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onPreview(voice)}
                className="w-[4.7rem] shrink-0 truncate rounded-lg px-1 py-1.5 text-left text-[0.68rem] font-semibold leading-tight text-slate-300 hover:bg-white/6 hover:text-white"
              >
                {VOICE_LABELS[voice]}
              </button>
              <div className="flex min-w-0 flex-1 gap-1">
                {Array.from({ length: beats }, (_, beat) => (
                  <div key={`${voice}-${beat}`} className="flex gap-px" style={{ flex: subdivisionSteps }}>
                    {Array.from({ length: subdivisionSteps }, (_, offset) => {
                      const step = beat * subdivisionSteps + offset
                      if (step >= steps) return null
                      const on = pattern[voice]?.[step]
                      const now = live && currentStep === step
                      return (
                        <button
                          key={step}
                          type="button"
                          aria-pressed={on}
                          aria-label={`${VOICE_LABELS[voice]}, beat ${beat + 1}, slot ${offset + 1}${on ? ', on' : ', off'}`}
                          onClick={() => onToggle(voice, step)}
                          className={cn(
                            'h-8 min-w-[1.05rem] flex-1 rounded-md border transition sm:h-9',
                            on
                              ? 'border-[#A855F7] bg-[#A855F7] shadow-[0_0_10px_rgba(168,85,247,0.35)]'
                              : offset === 0
                                ? 'border-white/14 bg-white/8 hover:bg-white/14'
                                : 'border-white/8 bg-white/4 hover:bg-white/10',
                            now && 'ring-2 ring-white/80 ring-offset-1 ring-offset-[#0B0F1A]',
                          )}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
