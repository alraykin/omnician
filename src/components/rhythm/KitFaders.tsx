import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import {
  KIT_GROUPS,
  KIT_GROUP_LABELS,
  KIT_MIX_MAX_DB,
  KIT_MIX_MIN_DB,
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
  const [held, setHeld] = useState<KitGroupId | null>(null)

  return (
    <div data-section="kit-faders" className="kit-fader-bank">
      <div className="kit-fader-channels">
        {KIT_GROUPS.map((group) => (
          <KitFader
            key={group}
            group={group}
            db={mix[group]}
            held={held === group}
            onChange={onChange}
            onHoldStart={() => setHeld(group)}
            onHoldEnd={() => setHeld((current) => (current === group ? null : current))}
          />
        ))}
      </div>
      {held && typeof document !== 'undefined'
        ? createPortal(
            <KitFaderZoom group={held} db={mix[held]} />,
            document.body,
          )
        : null}
    </div>
  )
}

function KitFader({
  group,
  db,
  held,
  onChange,
  onHoldStart,
  onHoldEnd,
}: {
  group: KitGroupId
  db: number
  held: boolean
  onChange: (group: KitGroupId, db: number) => void
  onHoldStart: () => void
  onHoldEnd: () => void
}) {
  const dragRef = useRef<{ pointerId: number; startY: number; startPos: number } | null>(null)

  const moveTo = useCallback(
    (clientY: number) => {
      const drag = dragRef.current
      if (!drag) return
      const nextPos = Math.min(1, Math.max(0, drag.startPos + (drag.startY - clientY) / FINE_TRAVEL_PX))
      onChange(group, mixPosToDb(nextPos))
    },
    [group, onChange],
  )

  const endHold = useCallback(
    (pointerId?: number) => {
      if (pointerId != null && dragRef.current && dragRef.current.pointerId !== pointerId) return
      dragRef.current = null
      onHoldEnd()
    },
    [onHoldEnd],
  )

  useEffect(() => {
    if (!held) return
    const onBlur = () => endHold()
    window.addEventListener('blur', onBlur)
    return () => window.removeEventListener('blur', onBlur)
  }, [held, endHold])

  return (
    <div
      className="kit-fader-channel"
      data-kit-fader={group}
      data-held={held ? 'true' : 'false'}
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
        onHoldStart()
      }}
      onPointerMove={(event) => {
        if (!dragRef.current || event.pointerId !== dragRef.current.pointerId) return
        event.preventDefault()
        moveTo(event.clientY)
      }}
      onPointerUp={(event) => endHold(event.pointerId)}
      onPointerCancel={() => endHold()}
      onLostPointerCapture={() => endHold()}
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
        <FaderThrow db={db} />
      </div>
      <span className="kit-fader-foot">
        <span className="kit-fader-readout" data-kit-readout={group}>
          {formatKitDb(db)}
        </span>
      </span>
    </div>
  )
}

function FaderThrow({ db }: { db: number }) {
  const pos = mixDbToPos(db)
  return (
    <div className="kit-fader-slot" style={{ ['--kit-fader-pos' as string]: String(pos) }}>
      <span className="kit-fader-rail" aria-hidden />
      <span className="kit-fader-fill" style={{ height: `${pos * 100}%` }} />
      <span className="kit-fader-zero" aria-hidden />
      <span className="kit-fader-cap" style={{ top: `calc(${(1 - pos) * 100}% - var(--kit-fader-cap-half))` }}>
        <span className="kit-fader-cap-face" />
      </span>
    </div>
  )
}

function KitFaderZoom({ group, db }: { group: KitGroupId; db: number }) {
  return (
    <div className="kit-fader-zoom" data-kit-fader-zoom={group} aria-hidden>
      <div className="kit-fader-zoom-card">
        <p className="kit-fader-zoom-name">{KIT_GROUP_LABELS[group]}</p>
        <div className="kit-fader-zoom-throw">
          <FaderThrow db={db} />
        </div>
        <p className="kit-fader-zoom-readout">{formatKitDb(db)}</p>
      </div>
    </div>
  )
}
