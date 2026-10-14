import { useCallback, useRef } from 'react'

import {
  INTENSITY_POS,
  INTENSITY_POS_LIST,
  intensityFromPos,
  intensityLabel,
  type KitIntensity,
} from '@/lib/kit-intensity'
import {
  KIT_GROUPS,
  KIT_GROUP_LABELS,
  formatKitDb,
  mixDbToPos,
  mixPosToDb,
  type KitGroupId,
  type KitMix,
} from '@/lib/kit-mix'
import { DRAG_DEADZONE_PX, cn } from '@/lib/utils'

export function KitMixerPanel({
  mix,
  intensity,
  onChange,
  onIntensityChange,
}: {
  mix: KitMix
  intensity: KitIntensity
  onChange: (group: KitGroupId, db: number) => void
  onIntensityChange: (next: KitIntensity) => void
}) {
  return (
    <div data-kit-mixer-panel className="flex flex-col gap-2.5">
      {KIT_GROUPS.map((group) => (
        <HorizFader
          key={group}
          id={group}
          label={KIT_GROUP_LABELS[group]}
          pos={mixDbToPos(mix[group])}
          readout={formatKitDb(mix[group])}
          onChangePos={(pos) => onChange(group, mixPosToDb(pos))}
        />
      ))}
      <HorizFader
        id="intensity"
        label="Intensity"
        pos={INTENSITY_POS[intensity]}
        readout={intensityLabel(intensity)}
        snap={INTENSITY_POS_LIST}
        onChangePos={(pos) => onIntensityChange(intensityFromPos(pos))}
      />
    </div>
  )
}

function HorizFader({
  id,
  label,
  pos,
  readout,
  snap,
  onChangePos,
}: {
  id: string
  label: string
  pos: number
  readout: string
  snap?: number[]
  onChangePos: (pos: number) => void
}) {
  const wellRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; startPos: number; moved: boolean } | null>(
    null,
  )
  const posRef = useRef(pos)
  posRef.current = pos

  const apply = useCallback(
    (next: number) => {
      const clamped = Math.min(1, Math.max(0, next))
      if (!snap?.length) {
        onChangePos(clamped)
        return
      }
      onChangePos(snap.reduce((best, item) => (Math.abs(item - clamped) < Math.abs(best - clamped) ? item : best)))
    },
    [onChangePos, snap],
  )

  return (
    <div data-kit-fader={id} data-section={id === 'intensity' ? 'kit-intensity' : undefined} className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</span>
        <span className="text-[0.68rem] font-semibold tabular-nums text-white" data-kit-readout={id}>
          {readout}
        </span>
      </div>
      <div
        ref={wellRef}
        role="slider"
        tabIndex={0}
        aria-label={`${label} level`}
        aria-orientation="horizontal"
        className="relative h-7 touch-none"
        onPointerDown={(event) => {
          if (event.button !== 0) return
          event.preventDefault()
          event.stopPropagation()
          event.currentTarget.setPointerCapture(event.pointerId)
          dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startPos: posRef.current,
            moved: false,
          }
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current
          if (!drag || event.pointerId !== drag.pointerId) return
          const dx = event.clientX - drag.startX
          const dy = event.clientY - drag.startY
          if (!drag.moved && Math.hypot(dx, dy) < DRAG_DEADZONE_PX) return
          if (!drag.moved && Math.abs(dy) > Math.abs(dx)) {
            dragRef.current = null
            return
          }
          drag.moved = true
          const well = wellRef.current
          const width = well?.getBoundingClientRect().width ?? 160
          apply(drag.startPos + dx / Math.max(80, width))
        }}
        onPointerUp={(event) => {
          const drag = dragRef.current
          if (drag && !drag.moved && wellRef.current) {
            const rect = wellRef.current.getBoundingClientRect()
            apply((event.clientX - rect.left) / Math.max(1, rect.width))
          }
          dragRef.current = null
        }}
        onPointerCancel={() => {
          dragRef.current = null
        }}
      >
        <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/12" />
        <span
          className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#A855F7]/80"
          style={{ width: `${Math.min(1, Math.max(0, pos)) * 100}%` }}
        />
        <span
          className={cn(
            'absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#E9D5FF] shadow-[0_0_0_3px_rgba(168,85,247,0.28)]',
          )}
          style={{ left: `${Math.min(1, Math.max(0, pos)) * 100}%` }}
        />
      </div>
    </div>
  )
}
