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
    <div className="grid grid-cols-2 gap-2" data-section="click-sound">
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
            'h-11 rounded-xl text-sm font-semibold',
            value === id ? 'bg-[#A855F7] text-white' : 'border border-white/10 bg-[#141A28] text-slate-200',
          )}
        >
          {CLICK_SOUND_LABELS[id]}
        </button>
      ))}
    </div>
  )
}
