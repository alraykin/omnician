import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { IntensitySwitch } from '@/components/rhythm/IntensitySwitch'
import { type KitIntensity } from '@/lib/kit-intensity'
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
import { DRAG_DEADZONE_PX, usesFaderZoom } from '@/lib/utils'

type KitFadersProps = {
  mix: KitMix
  intensity: KitIntensity
  onChange: (group: KitGroupId, db: number) => void
  onIntensityChange: (next: KitIntensity) => void
}

/** Finger travel (px) for a full fader throw — much longer than the visible track. */
const FINE_TRAVEL_PX = 340

export function KitFaders({ mix, intensity, onChange, onIntensityChange }: KitFadersProps) {
  const [held, setHeld] = useState<KitGroupId | null>(null)

  return (
    <div data-section="kit-faders" className="kit-fader-bank">
      <div className="kit-fader-channels">
        {KIT_GROUPS.map((group) => (
          <MixFader
            key={group}
            id={group}
            label={KIT_GROUP_LABELS[group]}
            pos={mixDbToPos(mix[group])}
            held={held === group}
            readout={formatKitDb(mix[group])}
            ariaValueMin={KIT_MIX_MIN_DB}
            ariaValueMax={KIT_MIX_MAX_DB}
            ariaValueNow={Math.round(mix[group] * 10) / 10}
            ariaValueText={formatKitDb(mix[group])}
            onChangePos={(pos) => onChange(group, mixPosToDb(pos))}
            onNudge={(delta, large) => onChange(group, clampKitDb(mix[group] + (large ? 0.25 : 0.5) * delta))}
            onHome={() => onChange(group, KIT_MIX_MAX_DB)}
            onEnd={() => onChange(group, KIT_MIX_MIN_DB)}
            onReset={() => onChange(group, 0)}
            onHoldStart={() => setHeld(group)}
            onHoldEnd={() => setHeld((current) => (current === group ? null : current))}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-center px-1">
        <IntensitySwitch value={intensity} onChange={onIntensityChange} />
      </div>
      {held && typeof document !== 'undefined'
        ? createPortal(
            <MixFaderZoom
              label={KIT_GROUP_LABELS[held]}
              pos={mixDbToPos(mix[held])}
              readout={formatKitDb(mix[held])}
            />,
            document.body,
          )
        : null}
    </div>
  )
}

function snapTo(pos: number, snaps?: number[]): number {
  const clamped = Math.min(1, Math.max(0, pos))
  if (!snaps?.length) return clamped
  return snaps.reduce((best, snap) => (Math.abs(snap - clamped) < Math.abs(best - clamped) ? snap : best))
}

function posFromClientY(well: HTMLDivElement | null, clientY: number): number {
  const rect = well?.getBoundingClientRect()
  if (!rect || rect.height <= 0) return 0
  return Math.min(1, Math.max(0, 1 - (clientY - rect.top) / rect.height))
}

function MixFader({
  id,
  label,
  pos,
  held,
  readout,
  ariaValueMin,
  ariaValueMax,
  ariaValueNow,
  ariaValueText,
  snap,
  clickToSet = false,
  onChangePos,
  onNudge,
  onHome,
  onEnd,
  onReset,
  onHoldStart,
  onHoldEnd,
}: {
  id: string
  label: string
  pos: number
  held: boolean
  readout: string
  ariaValueMin: number
  ariaValueMax: number
  ariaValueNow: number
  ariaValueText: string
  snap?: number[]
  clickToSet?: boolean
  onChangePos: (pos: number) => void
  onNudge: (delta: 1 | -1, large: boolean) => void
  onHome: () => void
  onEnd: () => void
  onReset?: () => void
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
  const posRef = useRef(pos)
  posRef.current = pos

  const applyPos = useCallback(
    (next: number) => {
      onChangePos(snapTo(next, snap))
    },
    [onChangePos, snap],
  )

  const moveTo = useCallback(
    (clientY: number) => {
      const drag = dragRef.current
      if (!drag) return
      applyPos(drag.startPos + (drag.startY - clientY) / drag.travel)
    },
    [applyPos],
  )

  const endHold = useCallback(
    (pointerId?: number, clientY?: number) => {
      if (pointerId != null && dragRef.current && dragRef.current.pointerId !== pointerId) return
      const drag = dragRef.current
      const tapped = Boolean(clickToSet && drag && !drag.moved && clientY != null)
      dragRef.current = null
      if (tapped) applyPos(posFromClientY(wellRef.current, clientY as number))
      onHoldEnd()
    },
    [applyPos, clickToSet, onHoldEnd],
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
      data-section={id === 'intensity' ? 'kit-intensity' : undefined}
      data-kit-intensity={id === 'intensity' ? readout.toLowerCase() : undefined}
      data-held={held ? 'true' : 'false'}
      role="slider"
      tabIndex={0}
      aria-label={`${label} level`}
      aria-valuemin={ariaValueMin}
      aria-valuemax={ariaValueMax}
      aria-valuenow={ariaValueNow}
      aria-valuetext={ariaValueText}
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
          startPos: posRef.current,
          travel: zoom && !snap ? FINE_TRAVEL_PX : Math.max(wellH, 80),
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
      onPointerUp={(event) => endHold(event.pointerId, event.clientY)}
      onPointerCancel={() => endHold()}
      onLostPointerCapture={() => endHold()}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
          event.preventDefault()
          onNudge(1, event.shiftKey)
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
          event.preventDefault()
          onNudge(-1, event.shiftKey)
        }
        if (event.key === 'Home') {
          event.preventDefault()
          onHome()
        }
        if (event.key === 'End') {
          event.preventDefault()
          onEnd()
        }
        if (onReset && (event.key === '0' || event.key === 'Delete')) {
          event.preventDefault()
          onReset()
        }
      }}
    >
      <span className="kit-fader-name">{label}</span>
      <div className="kit-fader-well" ref={wellRef}>
        <FaderThrow pos={pos} />
      </div>
      <span className="kit-fader-foot">
        <span className="kit-fader-readout" data-kit-readout={id}>
          {readout}
        </span>
      </span>
    </div>
  )
}

function FaderThrow({ pos }: { pos: number }) {
  const p = Math.min(1, Math.max(0, pos))
  return (
    <div className="kit-fader-slot" style={{ ['--kit-fader-pos' as string]: String(p) }}>
      <span className="kit-fader-rail" aria-hidden />
      <span className="kit-fader-fill" style={{ height: `${p * 100}%` }} />
      <span className="kit-fader-zero" aria-hidden />
      <span
        className="kit-fader-cap"
        style={{ top: `calc((1 - ${p}) * (100% - var(--kit-fader-cap-h)))` }}
      >
        <span className="kit-fader-cap-face" />
      </span>
    </div>
  )
}

function MixFaderZoom({ label, pos, readout }: { label: string; pos: number; readout: string }) {
  return (
    <div className="kit-fader-zoom" data-kit-fader-zoom={label.toLowerCase()} aria-hidden>
      <div className="kit-fader-zoom-card">
        <p className="kit-fader-zoom-name">{label}</p>
        <div className="kit-fader-zoom-throw">
          <FaderThrow pos={pos} />
        </div>
        <p className="kit-fader-zoom-readout">{readout}</p>
      </div>
    </div>
  )
}
