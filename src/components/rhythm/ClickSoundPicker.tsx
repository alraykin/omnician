import { CLICK_SOUND_LABELS, CLICK_SOUNDS, type ClickSoundId } from '@/lib/rhythm'
import { getOrCreateRhythmKit } from '@/lib/rhythm-audio'
import { cn } from '@/lib/utils'

export function ClickSoundPicker({
  value,
  onChange,
}: {
  value: ClickSoundId
  onChange: (id: ClickSoundId) => void
}) {
  return (
    <div
      className="grid min-w-0 grid-cols-4 gap-1 overflow-hidden"
      data-section="click-sound"
      data-click-sounds="row"
    >
      {CLICK_SOUNDS.map((id) => (
        <button
          key={id}
          type="button"
          data-click-sound={id}
          aria-pressed={value === id}
          onClick={() => {
            onChange(id)
            getOrCreateRhythmKit()?.previewClick(id)
          }}
          className={cn(
            'h-8 min-w-0 overflow-hidden whitespace-nowrap rounded-lg px-0.5 text-center text-[0.62rem] font-semibold leading-none tracking-tight touch-manipulation sm:h-10 sm:rounded-xl sm:px-1 sm:text-sm',
            value === id ? 'bg-[#A855F7] text-white' : 'border border-white/10 bg-[#141A28] text-slate-200',
          )}
        >
          {CLICK_SOUND_LABELS[id]}
        </button>
      ))}
    </div>
  )
}
