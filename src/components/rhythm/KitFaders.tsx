import { useCallback, useRef } from 'react'

import {
  KIT_GROUPS,
  KIT_GROUP_LABELS,
  KIT_MIX_MAX_DB,
  KIT_MIX_MIN_DB,
  KIT_SCALE_MARKS,
  clampKitDb,
  formatKitDb,
  mixDbToPos,
  mixPosToDb,
  type KitGroupId,
  type KitMix,
} from '@/lib/kit-mix'

type KitFadersProps = {
  mix: KitMix
  onChange: (group: KitGroupId, db: number) => void
}

/** Finger travel (px) for a full fader throw — much longer than the visible track. */
const FINE_TRAVEL_PX = 340

export function KitFaders({ mix, onChange }: KitFadersProps) {
  return (
    <div data-section="kit-faders" className="kit-fader-bank">
      <div className="kit-fader-scale" aria-hidden>
        <span className="kit-fader-scale-head" />
        <div className="kit-fader-scale-ladder">
          {KIT_SCALE_MARKS.map((mark) => (
            <span
              key={mark.label}
              className="kit-fader-scale-mark"
              data-db={mark.db}
              style={{ top: `${(1 - mixDbToPos(mark.db)) * 100}%` }}
            >
              {mark.label}
            </span>
          ))}
        </div>
        <span className="kit-fader-scale-foot" />
      </div>
      <div className="kit-fader-channels">
        {KIT_GROUPS.map((group) => (
          <KitFader key={group} group={group} db={mix[group]} onChange={onChange} />
        ))}
      </div>
    </div>
  )
}

function KitFader({
  group,
  db,
  onChange,
}: {
  group: KitGroupId
  db: number
  onChange: (group: KitGroupId, db: number) => void
}) {
  const dragRef = useRef<{ pointerId: number; startY: number; startPos: number } | null>(null)
  const pos = mixDbToPos(db)

  const moveTo = useCallback(
    (clientY: number) => {
      const drag = dragRef.current
      if (!drag) return
      const nextPos = Math.min(1, Math.max(0, drag.startPos + (drag.startY - clientY) / FINE_TRAVEL_PX))
      onChange(group, mixPosToDb(nextPos))
    },
    [group, onChange],
  )

  return (
    <div
      className="kit-fader-channel"
      data-kit-fader={group}
      role="slider"
      tabIndex={0}
      aria-label={`${KIT_GROUP_LABELS[group]} level`}
      aria-valuemin={KIT_MIX_MIN_DB}
      aria-valuemax={KIT_MIX_MAX_DB}
      aria-valuenow={Math.round(db * 10) / 10}
      aria-valuetext={formatKitDb(db)}
      aria-orientation="vertical"
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        event.currentTarget.setPointerCapture(event.pointerId)
        dragRef.current = { pointerId: event.pointerId, startY: event.clientY, startPos: mixDbToPos(db) }
      }}
      onPointerMove={(event) => {
        if (!dragRef.current || event.pointerId !== dragRef.current.pointerId) return
        event.preventDefault()
        moveTo(event.clientY)
      }}
      onPointerUp={(event) => {
        if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
      }}
      onPointerCancel={() => {
        dragRef.current = null
      }}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 0.25 : 0.5
        if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
          event.preventDefault()
          onChange(group, clampKitDb(db + step))
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
          event.preventDefault()
          onChange(group, clampKitDb(db - step))
        }
        if (event.key === 'Home') {
          event.preventDefault()
          onChange(group, KIT_MIX_MAX_DB)
        }
        if (event.key === 'End') {
          event.preventDefault()
          onChange(group, KIT_MIX_MIN_DB)
        }
        if (event.key === '0' || event.key === 'Delete') {
          event.preventDefault()
          onChange(group, 0)
        }
      }}
    >
      <span className="kit-fader-name">{KIT_GROUP_LABELS[group]}</span>
      <div className="kit-fader-well">
        <div className="kit-fader-slot">
          <span className="kit-fader-rail" aria-hidden />
          <span className="kit-fader-fill" style={{ height: `${pos * 100}%` }} />
          <span className="kit-fader-zero" aria-hidden />
          <span className="kit-fader-cap" style={{ top: `calc(${(1 - pos) * 100}% - 0.42rem)` }}>
            <span className="kit-fader-cap-face" />
          </span>
        </div>
      </div>
      <span className="kit-fader-inf" aria-hidden>
        ∞
      </span>
    </div>
  )
}
