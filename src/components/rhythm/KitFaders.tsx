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
import { DRAG_DEADZONE_PX, HOLD_TO_DRAG_MS, accumulatedScroll } from '@/lib/utils'

type KitFadersProps = {
  mix: KitMix
  onChange: (group: KitGroupId, db: number) => void
}

/** Finger travel (px) for a full fader throw — much longer than the visible track. */
const FINE_TRAVEL_PX = 340

export function KitFaders({ mix, onChange }: KitFadersProps) {
  const [held, setHeld] = useState<KitGroupId | null>(null)
  const [wideUi, setWideUi] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const sync = () => setWideUi(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  return (
    <div data-section="kit-faders" className="kit-fader-bank" data-wide={wideUi ? 'true' : 'false'}>
      <div className="kit-fader-channels">
        {KIT_GROUPS.map((group) => (
          <KitFader
            key={group}
            group={group}
            db={mix[group]}
            held={held === group}
            wideUi={wideUi}
            onChange={onChange}
            onHoldStart={() => setHeld(group)}
            onHoldEnd={() => setHeld((current) => (current === group ? null : current))}
          />
        ))}
      </div>
      {held && !wideUi && typeof document !== 'undefined'
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
  wideUi,
  onChange,
  onHoldStart,
  onHoldEnd,
}: {
  group: KitGroupId
  db: number
  held: boolean
  wideUi: boolean
  onChange: (group: KitGroupId, db: number) => void
  onHoldStart: () => void
  onHoldEnd: () => void
}) {
  const dragRef = useRef<{ pointerId: number; startY: number; startPos: number; travel: number } | null>(null)
  const pendingRef = useRef<{
    pointerId: number
    x: number
    y: number
    scroll: number
    startPos: number
    travel: number
    armed: boolean
    ignored: boolean
  } | null>(null)
  const holdTimerRef = useRef(0)
  const wellRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<HTMLDivElement>(null)

  const moveTo = useCallback(
    (clientY: number) => {
      const drag = dragRef.current
      if (!drag) return
      const nextPos = Math.min(1, Math.max(0, drag.startPos + (drag.startY - clientY) / drag.travel))
      onChange(group, mixPosToDb(nextPos))
    },
    [group, onChange],
  )

  const endHold = useCallback(
    (pointerId?: number) => {
      if (pointerId != null && dragRef.current && dragRef.current.pointerId !== pointerId) return
      window.clearTimeout(holdTimerRef.current)
      pendingRef.current = null
      dragRef.current = null
      onHoldEnd()
    },
    [onHoldEnd],
  )

  const engage = useCallback(
    (clientY: number, pointerId: number) => {
      const pending = pendingRef.current
      if (!pending || pending.ignored || dragRef.current) return
      dragRef.current = {
        pointerId,
        startY: pending.y,
        startPos: pending.startPos,
        travel: pending.travel,
      }
      pendingRef.current = null
      window.clearTimeout(holdTimerRef.current)
      channelRef.current?.setPointerCapture(pointerId)
      onHoldStart()
      const nextPos = Math.min(1, Math.max(0, dragRef.current.startPos + (dragRef.current.startY - clientY) / dragRef.current.travel))
      onChange(group, mixPosToDb(nextPos))
    },
    [group, onChange, onHoldStart],
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
        const wellH = wellRef.current?.getBoundingClientRect().height ?? FINE_TRAVEL_PX
        pendingRef.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          scroll: accumulatedScroll(event.currentTarget),
          startPos: mixDbToPos(db),
          travel: wideUi ? Math.max(wellH, 80) : FINE_TRAVEL_PX,
          armed: false,
          ignored: false,
        }
        window.clearTimeout(holdTimerRef.current)
        holdTimerRef.current = window.setTimeout(() => {
          const pending = pendingRef.current
          if (!pending || pending.ignored) return
          pending.armed = true
        }, HOLD_TO_DRAG_MS)
      }}
      onPointerMove={(event) => {
        if (dragRef.current && event.pointerId === dragRef.current.pointerId) {
          event.preventDefault()
          moveTo(event.clientY)
          return
        }
        const pending = pendingRef.current
        if (!pending || pending.pointerId !== event.pointerId || pending.ignored) return
        if (Math.abs(accumulatedScroll(event.currentTarget) - pending.scroll) > 1) {
          pending.ignored = true
          window.clearTimeout(holdTimerRef.current)
          return
        }
        const dx = event.clientX - pending.x
        const dy = event.clientY - pending.y
        const dist = Math.hypot(dx, dy)
        if (dist < DRAG_DEADZONE_PX) return
        if (Math.abs(dx) > Math.abs(dy)) {
          pending.ignored = true
          window.clearTimeout(holdTimerRef.current)
          return
        }
        if (!pending.armed && Math.abs(dy) > Math.abs(dx) * 1.2) {
          pending.ignored = true
          window.clearTimeout(holdTimerRef.current)
          return
        }
        if (!pending.armed) return
        event.preventDefault()
        engage(event.clientY, event.pointerId)
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
      <div className="kit-fader-well" ref={wellRef}>
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
