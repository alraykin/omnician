import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import {
  KIT_GROUPS,
  KIT_GROUP_LABELS,
  KIT_MIX_MAX_DB,
  KIT_MIX_MIN_DB,
  clampKitDb,
  formatKitDb,
  formatMasterVolume,
  mixDbToPos,
  mixPosToDb,
  type KitGroupId,
  type KitMix,
} from '@/lib/kit-mix'
import { DRAG_DEADZONE_PX, usesFaderZoom } from '@/lib/utils'

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
          <MixFader
            key={group}
            id={group}
            label={KIT_GROUP_LABELS[group]}
            db={mix[group]}
            held={held === group}
            readout={formatKitDb(mix[group])}
            onChange={(db) => onChange(group, db)}
            onHoldStart={() => setHeld(group)}
            onHoldEnd={() => setHeld((current) => (current === group ? null : current))}
          />
        ))}
      </div>
      {held && typeof document !== 'undefined'
        ? createPortal(
            <MixFaderZoom label={KIT_GROUP_LABELS[held]} db={mix[held]} readout={formatKitDb(mix[held])} />,
            document.body,
          )
        : null}
    </div>
  )
}

export function VolumeFader({
  db,
  onChange,
}: {
  db: number
  onChange: (db: number) => void
}) {
  const [held, setHeld] = useState(false)
  const readout = formatMasterVolume(db)

  return (
    <>
      <MixFader
        id="volume"
        label="Volume"
        db={db}
        held={held}
        compact
        readout={readout}
        onChange={onChange}
        onHoldStart={() => setHeld(true)}
        onHoldEnd={() => setHeld(false)}
      />
      {held && typeof document !== 'undefined'
        ? createPortal(<MixFaderZoom label="Volume" db={db} readout={readout} />, document.body)
        : null}
    </>
  )
}

function MixFader({
  id,
  label,
  db,
  held,
  compact = false,
  readout,
  onChange,
  onHoldStart,
  onHoldEnd,
}: {
  id: string
  label: string
  db: number
  held: boolean
  compact?: boolean
  readout: string
  onChange: (db: number) => void
  onHoldStart: () => void
  onHoldEnd: () => void
}) {
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    startPos: number
    travel: number
    moved: boolean
  } | null>(null)
  const wellRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<HTMLDivElement>(null)

  const moveTo = useCallback(
    (clientY: number) => {
      const drag = dragRef.current
      if (!drag) return
      const nextPos = Math.min(1, Math.max(0, drag.startPos + (drag.startY - clientY) / drag.travel))
      onChange(mixPosToDb(nextPos))
    },
    [onChange],
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
      ref={channelRef}
      className="kit-fader-channel"
      data-kit-fader={id}
      data-volume={compact ? 'true' : undefined}
      data-held={held ? 'true' : 'false'}
      role="slider"
      tabIndex={0}
      aria-label={`${label} level`}
      aria-valuemin={KIT_MIX_MIN_DB}
      aria-valuemax={KIT_MIX_MAX_DB}
      aria-valuenow={Math.round(db * 10) / 10}
      aria-valuetext={compact ? `${readout}, ${formatKitDb(db)}` : readout}
      aria-orientation="vertical"
      onPointerDown={(event) => {
        if (event.button !== 0) return
        const zoom = usesFaderZoom(event.pointerType)
        const wellH = wellRef.current?.getBoundingClientRect().height ?? FINE_TRAVEL_PX
        event.preventDefault()
        event.stopPropagation()
        event.currentTarget.setPointerCapture(event.pointerId)
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startPos: mixDbToPos(db),
          travel: zoom ? FINE_TRAVEL_PX : Math.max(wellH, 80),
          moved: false,
        }
        if (zoom) onHoldStart()
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current
        if (!drag || event.pointerId !== drag.pointerId) return
        if (!drag.moved) {
          const dx = event.clientX - drag.startX
          const dy = event.clientY - drag.startY
          if (Math.hypot(dx, dy) < DRAG_DEADZONE_PX) return
          if (Math.abs(dx) > Math.abs(dy)) {
            endHold(event.pointerId)
            return
          }
          drag.moved = true
        }
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
          onChange(clampKitDb(db + step))
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
          event.preventDefault()
          onChange(clampKitDb(db - step))
        }
        if (event.key === 'Home') {
          event.preventDefault()
          onChange(KIT_MIX_MAX_DB)
        }
        if (event.key === 'End') {
          event.preventDefault()
          onChange(KIT_MIX_MIN_DB)
        }
        if (event.key === '0' || event.key === 'Delete') {
          event.preventDefault()
          onChange(0)
        }
      }}
    >
      <span className="kit-fader-name">{label}</span>
      <div className="kit-fader-well" ref={wellRef}>
        <FaderThrow db={db} />
      </div>
      <span className="kit-fader-foot">
        <span className="kit-fader-readout" data-kit-readout={id}>
          {readout}
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

function MixFaderZoom({ label, db, readout }: { label: string; db: number; readout: string }) {
  return (
    <div className="kit-fader-zoom" data-kit-fader-zoom={label.toLowerCase()} aria-hidden>
      <div className="kit-fader-zoom-card">
        <p className="kit-fader-zoom-name">{label}</p>
        <div className="kit-fader-zoom-throw">
          <FaderThrow db={db} />
        </div>
        <p className="kit-fader-zoom-readout">{readout}</p>
      </div>
    </div>
  )
}
