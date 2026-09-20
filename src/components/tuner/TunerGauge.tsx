import { Check } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

type TunerGaugeProps = {
  cents: number | null
  inTune: boolean
  active: boolean
}

type Proximity = 'idle' | 'far' | 'closer' | 'near' | 'lock'

const HISTORY = 96

function proximityOf(absCents: number, active: boolean, inTune: boolean): Proximity {
  if (!active) return 'idle'
  if (inTune) return 'lock'
  if (absCents > 26) return 'far'
  if (absCents > 14) return 'closer'
  return 'near'
}

function colorOf(proximity: Proximity): string {
  if (proximity === 'lock') return '#34d399'
  if (proximity === 'near') return '#a3e635'
  if (proximity === 'closer') return '#fbbf24'
  if (proximity === 'far') return '#e2e8f0'
  return 'rgba(255,255,255,0.28)'
}

function mixColor(absCents: number): string {
  if (absCents <= 8) return '#34d399'
  if (absCents <= 16) return '#a3e635'
  if (absCents <= 28) return '#fbbf24'
  return '#c4b5fd'
}

export function TunerGauge({ cents, inTune, active }: TunerGaugeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const shownRef = useRef(0)
  const historyRef = useRef<number[]>([])
  const centsRef = useRef(cents)
  const inTuneRef = useRef(inTune)
  const activeRef = useRef(active)

  centsRef.current = cents
  inTuneRef.current = inTune
  activeRef.current = active

  useEffect(() => {
    let raf = 0
    let lastTrail = 0

    const tick = (now: number) => {
      const live = activeRef.current
      const targetCents = centsRef.current
      const locked = inTuneRef.current && live
      const target =
        !live || targetCents === null
          ? shownRef.current * 0.9
          : Math.max(-50, Math.min(50, targetCents))

      const delta = target - shownRef.current
      const catchUp = Math.abs(delta) > 22 ? 0.2 : locked ? 0.08 : 0.12
      shownRef.current += delta * catchUp
      if (locked) shownRef.current += (0 - shownRef.current) * 0.07
      if (Math.abs(shownRef.current) < 0.08) shownRef.current = 0

      if (now - lastTrail > 22) {
        lastTrail = now
        const history = historyRef.current
        if (live && targetCents !== null) {
          history.push(shownRef.current)
          if (history.length > HISTORY) history.shift()
        } else if (history.length > 0) {
          history.splice(0, Math.max(1, Math.ceil(history.length / 18)))
        }
      }

      drawTrail(
        canvasRef.current,
        historyRef.current,
        shownRef.current,
        live && targetCents !== null,
        locked,
      )
      raf = requestAnimationFrame(tick)
    }

    const onResize = () => {
      drawTrail(
        canvasRef.current,
        historyRef.current,
        shownRef.current,
        activeRef.current && centsRef.current !== null,
        inTuneRef.current && activeRef.current,
      )
    }

    window.addEventListener('resize', onResize)
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const proximity = proximityOf(
    Math.abs(cents ?? 0),
    active && cents !== null,
    inTune && active,
  )

  return (
    <div className="flex w-full flex-1 flex-col" aria-hidden>
      <div
        ref={frameRef}
        className="relative min-h-[18.5rem] w-full flex-1 overflow-hidden rounded-3xl bg-[#0B1020] ring-1 ring-white/8 sm:min-h-[22rem]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-between px-4 text-[0.65rem] font-medium uppercase tracking-wider text-slate-500">
          <span>Flat</span>
          <span className={cn(inTune && active && 'text-emerald-300')}>In tune</span>
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
        <div
          className="pointer-events-none absolute bottom-3 left-1/2 z-10 h-2.5 w-2.5 -translate-x-1/2 rounded-full"
          style={{
            background: colorOf(proximity),
            boxShadow:
              proximity === 'lock'
                ? '0 0 16px rgba(52, 211, 153, 0.9)'
                : '0 0 10px rgba(168, 85, 247, 0.35)',
          }}
        />
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
  const bottom = height - 18
  const usable = Math.max(40, bottom - top)
  const xOf = (cents: number) => midX + (cents / 50) * (width * 0.42)

  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 1
  ;[-50, -25, 25, 50].forEach((mark) => {
    ctx.beginPath()
    ctx.moveTo(xOf(mark), top)
    ctx.lineTo(xOf(mark), bottom)
    ctx.stroke()
  })

  ctx.strokeStyle = locked ? 'rgba(52, 211, 153, 0.55)' : 'rgba(168, 85, 247, 0.28)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(midX, top)
  ctx.lineTo(midX, bottom)
  ctx.stroke()

  const lane = ctx.createLinearGradient(midX - 28, 0, midX + 28, 0)
  lane.addColorStop(0, 'rgba(52, 211, 153, 0)')
  lane.addColorStop(0.5, locked ? 'rgba(52, 211, 153, 0.16)' : 'rgba(168, 85, 247, 0.08)')
  lane.addColorStop(1, 'rgba(52, 211, 153, 0)')
  ctx.fillStyle = lane
  ctx.fillRect(midX - 28, top, 56, usable)

  const points = history.length > 0 ? history : live ? [shown] : []
  if (points.length < 2) {
    if (live && points.length === 1) {
      paintHead(ctx, xOf(points[0]), bottom, mixColor(Math.abs(points[0])), locked)
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
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.18)'
  ctx.lineWidth = 14
  ctx.stroke()

  for (let i = 1; i < points.length; i += 1) {
    const t = i / (points.length - 1)
    ctx.beginPath()
    ctx.moveTo(xOf(points[i - 1]), yAt(i - 1))
    ctx.lineTo(xOf(points[i]), yAt(i))
    ctx.strokeStyle = mixColor(Math.abs(points[i]))
    ctx.globalAlpha = 0.28 + t * 0.72
    ctx.lineWidth = 2.4 + t * 3.2
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  paintHead(ctx, xOf(points[points.length - 1]), bottom, mixColor(Math.abs(shown)), locked)
}

function paintHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  locked: boolean,
) {
  ctx.beginPath()
  ctx.fillStyle = locked ? 'rgba(52, 211, 153, 0.28)' : 'rgba(168, 85, 247, 0.2)'
  ctx.arc(x, y, locked ? 16 : 12, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.fillStyle = color
  ctx.arc(x, y, 5, 0, Math.PI * 2)
  ctx.fill()
}
