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
          <MixFader
            key={group}
            id={group}
            label={KIT_GROUP_LABELS[group]}
            db={mix[group]}
            held={held === group}
            wideUi={wideUi}
            readout={formatKitDb(mix[group])}
            onChange={(db) => onChange(group, db)}
            onHoldStart={() => setHeld(group)}
            onHoldEnd={() => setHeld((current) => (current === group ? null : current))}
          />
        ))}
      </div>
      {held && !wideUi && typeof document !== 'undefined'
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
  const [wideUi, setWideUi] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const sync = () => setWideUi(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  const readout = formatMasterVolume(db)

  return (
    <>
      <MixFader
        id="volume"
        label="Volume"
        db={db}
        held={held}
        wideUi={wideUi}
        compact
        readout={readout}
        onChange={onChange}
        onHoldStart={() => setHeld(true)}
        onHoldEnd={() => setHeld(false)}
      />
      {held && !wideUi && typeof document !== 'undefined'
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
  wideUi,
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
  wideUi: boolean
  compact?: boolean
  readout: string
  onChange: (db: number) => void
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
      onChange(mixPosToDb(nextPos))
    },
    [onChange],
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
      onChange(mixPosToDb(nextPos))
    },
    [onChange, onHoldStart],
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
