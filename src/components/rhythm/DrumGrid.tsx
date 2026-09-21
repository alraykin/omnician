import {
  VOICE_LABELS,
  VOICES,
  beatIndexForStep,
  type Meter,
  type Pattern,
  type VoiceId,
} from '@/lib/rhythm'
import { cn } from '@/lib/utils'

type DrumGridProps = {
  meter: Meter
  pattern: Pattern
  currentStep: number
  onToggle: (voice: VoiceId, step: number) => void
  onPreview: (voice: VoiceId) => void
}

export function DrumGrid({
  meter,
  pattern,
  currentStep,
  onToggle,
  onPreview,
}: DrumGridProps) {
  const steps = pattern.kick.length
  const groups = meter.groupSizes
  const starts: number[] = []
  let cursor = 0
  for (const size of groups) {
    starts.push(cursor)
    cursor += size
  }

  return (
    <div className="overflow-x-auto pb-1">
      <div className="min-w-[18rem]">
        <div className="mb-1.5 flex items-center gap-1 pl-[4.6rem] text-[0.6rem] font-semibold uppercase tracking-wider text-slate-500">
          {groups.map((size, group) => (
            <span
              key={`beat-${group}`}
              className="flex-1 text-center"
              style={{ flexGrow: size }}
            >
              {beatIndexForStep(starts[group], meter) + 1}
            </span>
          ))}
        </div>

        <div className="space-y-1">
          {VOICES.map((voice) => (
            <div key={voice} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onPreview(voice)}
                className="w-[4.4rem] shrink-0 truncate rounded-lg px-1 py-2 text-left text-[0.7rem] font-semibold text-slate-300 hover:bg-white/6 hover:text-white"
              >
                {VOICE_LABELS[voice]}
              </button>
              <div className="flex min-w-0 flex-1 gap-1">
                {groups.map((size, group) => {
                  const start = starts[group]
                  return (
                    <div key={`${voice}-${group}`} className="flex flex-1 gap-px">
                      {Array.from({ length: size }, (_, offset) => {
                        const step = start + offset
                        if (step >= steps) return null
                        const on = pattern[voice][step]
                        const live = currentStep === step
                        const downbeat = offset === 0
                        return (
                          <button
                            key={step}
                            type="button"
                            aria-pressed={on}
                            aria-label={`${VOICE_LABELS[voice]}, beat ${group + 1}, step ${offset + 1}${on ? ', on' : ', off'}`}
                            onClick={() => onToggle(voice, step)}
                            className={cn(
                              'h-9 min-w-0 flex-1 rounded-md border transition sm:h-10',
                              on
                                ? 'border-[#A855F7] bg-[#A855F7] shadow-[0_0_10px_rgba(168,85,247,0.35)]'
                                : downbeat
                                  ? 'border-white/14 bg-white/8 hover:bg-white/14'
                                  : 'border-white/8 bg-white/4 hover:bg-white/10',
                              live && 'ring-2 ring-white/80 ring-offset-1 ring-offset-[#0B0F1A]',
                            )}
                          />
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
