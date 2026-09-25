import { Check } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

type TunerGaugeProps = {
  cents: number | null
  readout: number | null
  inTune: boolean
  active: boolean
}

const HISTORY = 80
const DEADZONE = 1.6

function mixColor(absCents: number, intensity = 1): string {
  const t = Math.min(1, absCents / 40)
  if (t < 0.18) return fade('#34d399', intensity)
  if (t < 0.38) return fade('#a3e635', intensity)
  if (t < 0.62) return fade('#fbbf24', intensity)
  return fade('#f87171', intensity)
}

function fade(hex: string, intensity: number): string {
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0.25, intensity)})`
}

export function TunerGauge({ cents, readout, inTune, active }: TunerGaugeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const shownRef = useRef(0)
  const historyRef = useRef<number[]>([])
  const centsRef = useRef(cents)
  const readoutRef = useRef(readout)
  const inTuneRef = useRef(inTune)
  const activeRef = useRef(active)

  centsRef.current = cents
  readoutRef.current = readout
  inTuneRef.current = inTune
  activeRef.current = active

  useEffect(() => {
    let raf = 0
    let lastTrail = 0

    const tick = (now: number) => {
      const live = activeRef.current
      const targetCents = centsRef.current
      const locked = inTuneRef.current && live
      let target = 0
      if (live && targetCents !== null) {
        const clamped = Math.max(-50, Math.min(50, targetCents))
        target = Math.abs(clamped) < DEADZONE || locked ? 0 : clamped
      } else {
        target = shownRef.current * 0.88
      }

      const delta = target - shownRef.current
      const catchUp = locked ? 0.38 : Math.abs(delta) > 10 ? 0.42 : 0.2
      shownRef.current += delta * catchUp
      if (locked) shownRef.current += (0 - shownRef.current) * 0.4
      if (Math.abs(shownRef.current) < 0.28) shownRef.current = 0

      if (now - lastTrail > 16) {
        lastTrail = now
        const history = historyRef.current
        if (live && targetCents !== null) {
          history.push(shownRef.current)
          if (history.length > HISTORY) history.shift()
        } else if (history.length > 0) {
          history.splice(0, Math.max(1, Math.ceil(history.length / 22)))
        }
      }

      drawTrail(
        canvasRef.current,
        historyRef.current,
        shownRef.current,
        live && targetCents !== null,
        locked,
        readoutRef.current,
      )
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="flex w-full flex-1 flex-col" aria-hidden>
      <div
        className={cn(
          'relative min-h-[15.5rem] w-full flex-1 overflow-hidden rounded-3xl bg-[#0B1020] ring-1 sm:min-h-[18rem]',
          inTune && active ? 'omni-hold-glow ring-emerald-400/70' : 'ring-white/8',
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-between px-4 text-[0.65rem] font-medium uppercase tracking-wider text-slate-500">
          <span>Flat</span>
          <span className={cn(inTune && active ? 'text-emerald-300' : '')}>
            In tune
          </span>
          <span>Sharp</span>
        </div>
        <canvas ref={canvasRef} className="absolute inset-0 size-full" />
        <div
          className={cn(
            'absolute left-1/2 top-3 z-10 flex size-8 -translate-x-1/2 items-center justify-center rounded-full',
            inTune && active
              ? 'omni-in-tune-pop bg-emerald-400 text-[#06281c] shadow-[0_0_22px_rgba(52,211,153,0.7)]'
              : 'bg-transparent text-transparent',
          )}
        >
          <Check className="size-4 stroke-[3]" />
        </div>
      </div>
    </div>
  )
}

function drawTrail(
  canvas: HTMLCanvasElement | null,
  history: number[],
  shown: number,
  live: boolean,
  locked: boolean,
  readout: number | null,
) {
  if (!canvas) return
  const parent = canvas.parentElement
  if (!parent) return

  const width = parent.clientWidth
  const height = parent.clientHeight
  if (width < 8 || height < 8) return

  const dpr = window.devicePixelRatio || 1
  if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  const midX = width / 2
  const top = 36
  const bottom = height - 22
  const usable = Math.max(40, bottom - top)
  const reach = width * 0.44
  const xOf = (value: number) => midX + (value / 50) * reach

  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 1
  ;[-50, -25, 25, 50].forEach((mark) => {
    ctx.beginPath()
    ctx.moveTo(xOf(mark), top)
    ctx.lineTo(xOf(mark), bottom)
    ctx.stroke()
  })

  ctx.fillStyle = 'rgba(148, 163, 184, 0.55)'
  ctx.font = '10px Outfit, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('−50¢', xOf(-50), height - 6)
  ctx.fillText('+50¢', xOf(50), height - 6)

  ctx.strokeStyle = locked ? 'rgba(52, 211, 153, 0.6)' : 'rgba(168, 85, 247, 0.3)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(midX, top)
  ctx.lineTo(midX, bottom)
  ctx.stroke()

  const laneW = locked ? 36 : 26
  const lane = ctx.createLinearGradient(midX - laneW, 0, midX + laneW, 0)
  lane.addColorStop(0, 'rgba(52, 211, 153, 0)')
  lane.addColorStop(0.5, locked ? 'rgba(52, 211, 153, 0.28)' : 'rgba(168, 85, 247, 0.08)')
  lane.addColorStop(1, 'rgba(52, 211, 153, 0)')
  ctx.fillStyle = lane
  ctx.fillRect(midX - laneW, top, laneW * 2, usable)

  const points = history.length > 0 ? history : live ? [shown] : []
  if (points.length < 2) {
    if (live && points.length === 1) {
      paintBubble(ctx, xOf(points[0]), bottom, mixColor(Math.abs(points[0])), locked, readout)
    }
    return
  }

  const yAt = (index: number) => top + (index / (points.length - 1)) * usable

  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()
  points.forEach((value, index) => {
    const x = xOf(value)
    const py = yAt(index)
    if (index === 0) ctx.moveTo(x, py)
    else ctx.lineTo(x, py)
  })
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.16)'
  ctx.lineWidth = 16
  ctx.stroke()

  for (let i = 1; i < points.length; i += 1) {
    const t = i / (points.length - 1)
    ctx.beginPath()
    ctx.moveTo(xOf(points[i - 1]), yAt(i - 1))
    ctx.lineTo(xOf(points[i]), yAt(i))
    ctx.strokeStyle = mixColor(Math.abs(points[i]), 0.35 + t * 0.65)
    ctx.globalAlpha = 0.35 + t * 0.65
    ctx.lineWidth = 2.2 + t * 3.6
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  paintBubble(
    ctx,
    xOf(points[points.length - 1]),
    bottom,
    mixColor(Math.abs(shown)),
    locked,
    readout,
  )
}

function paintBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  locked: boolean,
  readout: number | null,
) {
  const label =
    readout === null
      ? null
      : readout === 0
        ? '0'
        : readout > 0
          ? `+${readout}`
          : `−${Math.abs(readout)}`
  const radius = locked ? 22 : label && label.length > 3 ? 24 : 20

  ctx.beginPath()
  ctx.fillStyle = locked ? 'rgba(52, 211, 153, 0.28)' : 'rgba(12, 16, 28, 0.88)'
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = locked ? '#34d399' : color
  ctx.stroke()

  if (label === null) return
  ctx.fillStyle = locked ? '#ecfdf5' : '#fff7ed'
  ctx.font = `700 ${label.length > 4 ? 13 : 16}px Outfit, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, x, y + 0.5)
}
