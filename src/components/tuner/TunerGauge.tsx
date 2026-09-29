import { Check } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { formatTenths } from '@/lib/feel'
import { cn } from '@/lib/utils'

type TunerGaugeProps = {
  cents: number | null
  readout: number | null
  inTune: boolean
  active: boolean
}

export function TunerGauge({ cents, readout, inTune, active }: TunerGaugeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const shownRef = useRef(0)
  const offsetRef = useRef(0)
  const lastTimeRef = useRef(0)
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

    const tick = (now: number) => {
      const last = lastTimeRef.current || now
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000))
      lastTimeRef.current = now

      const live = activeRef.current
      const targetCents = centsRef.current
      const locked = inTuneRef.current && live

      if (live && targetCents !== null) {
        const clamped = Math.max(-50, Math.min(50, targetCents))
        const delta = clamped - shownRef.current
        const follow = Math.abs(delta) > 8 ? 0.48 : 0.34
        shownRef.current += delta * follow
      } else {
        shownRef.current *= 0.9
      }

      const shown = shownRef.current
      const speed = live && targetCents !== null ? shown * 14 : 0
      offsetRef.current += speed * dt

      drawStrobe(
        canvasRef.current,
        offsetRef.current,
        shown,
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
          'relative min-h-[15.5rem] w-full flex-1 overflow-hidden rounded-3xl bg-[#070A12] ring-1 sm:min-h-[18rem] wide:min-h-[12rem] wide:flex-none',
          inTune && active ? 'omni-hold-glow ring-emerald-400/70' : 'ring-white/8',
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-between px-4 text-[0.65rem] font-medium uppercase tracking-wider text-slate-500">
          <span>Flat</span>
          <span className={cn(inTune && active ? 'text-emerald-300' : 'text-purple-300')}>
            {inTune && active ? 'Locked' : 'Strobe'}
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

function drawStrobe(
  canvas: HTMLCanvasElement | null,
  offset: number,
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

  const top = 40
  const bottom = height - 28
  const usable = Math.max(48, bottom - top)
  const midX = width / 2
  const midY = top + usable / 2
  const pitch = Math.max(22, Math.min(36, width / 14))
  const shift = ((offset % pitch) + pitch) % pitch

  const purple = locked ? 'rgba(52, 211, 153, 0.82)' : 'rgba(168, 85, 247, 0.78)'
  const purpleDim = locked ? 'rgba(16, 185, 129, 0.18)' : 'rgba(88, 28, 135, 0.45)'
  const ink = locked ? 'rgba(6, 40, 28, 0.55)' : 'rgba(7, 10, 18, 0.88)'

  ctx.fillStyle = '#070A12'
  ctx.fillRect(0, 0, width, height)

  const band = ctx.createLinearGradient(0, top, 0, bottom)
  band.addColorStop(0, 'rgba(168, 85, 247, 0.05)')
  band.addColorStop(0.5, locked ? 'rgba(52, 211, 153, 0.08)' : 'rgba(168, 85, 247, 0.12)')
  band.addColorStop(1, 'rgba(168, 85, 247, 0.05)')
  ctx.fillStyle = band
  ctx.fillRect(0, top, width, usable)

  for (let x = -pitch * 2 + shift; x < width + pitch * 2; x += pitch) {
    drawChevron(ctx, x, top + 8, pitch * 0.92, usable - 16, purple, purpleDim)
  }

  ctx.fillStyle = ink
  ctx.globalAlpha = 0.35
  ctx.fillRect(0, top, width * 0.08, usable)
  ctx.fillRect(width * 0.92, top, width * 0.08, usable)
  ctx.globalAlpha = 1

  const windowW = locked ? 54 : 38
  const lane = ctx.createLinearGradient(midX - windowW, 0, midX + windowW, 0)
  lane.addColorStop(0, 'rgba(7, 10, 18, 0)')
  lane.addColorStop(0.45, locked ? 'rgba(52, 211, 153, 0.22)' : 'rgba(168, 85, 247, 0.16)')
  lane.addColorStop(0.55, locked ? 'rgba(52, 211, 153, 0.22)' : 'rgba(168, 85, 247, 0.16)')
  lane.addColorStop(1, 'rgba(7, 10, 18, 0)')
  ctx.fillStyle = lane
  ctx.fillRect(midX - windowW, top, windowW * 2, usable)

  ctx.strokeStyle = locked ? 'rgba(52, 211, 153, 0.95)' : 'rgba(232, 221, 255, 0.55)'
  ctx.lineWidth = locked ? 3 : 2
  ctx.beginPath()
  ctx.moveTo(midX, top)
  ctx.lineTo(midX, bottom)
  ctx.stroke()

  const reach = width * 0.42
  const xOf = (value: number) => midX + (value / 50) * reach
  if (live) {
    const markerX = xOf(shown)
    ctx.beginPath()
    ctx.fillStyle = locked ? '#34d399' : '#e9d5ff'
    ctx.moveTo(markerX, top + 2)
    ctx.lineTo(markerX - 6, top + 12)
    ctx.lineTo(markerX + 6, top + 12)
    ctx.closePath()
    ctx.fill()
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1
  ;[-50, -25, 25, 50].forEach((mark) => {
    ctx.beginPath()
    ctx.moveTo(xOf(mark), bottom - 10)
    ctx.lineTo(xOf(mark), bottom)
    ctx.stroke()
  })

  ctx.fillStyle = 'rgba(148, 163, 184, 0.7)'
  ctx.font = '10px Outfit, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('−50¢', xOf(-50), height - 8)
  ctx.fillText('+50¢', xOf(50), height - 8)

  const label =
    readout === null || !live ? null : `${formatTenths(readout)}¢`

  if (label) {
    ctx.font = '700 28px Outfit, sans-serif'
    const textW = ctx.measureText(label).width
    const boxW = textW + 28
    const boxH = 44
    const boxX = midX - boxW / 2
    const boxY = midY - boxH / 2
    ctx.beginPath()
    roundRect(ctx, boxX, boxY, boxW, boxH, 14)
    ctx.fillStyle = locked ? 'rgba(6, 40, 28, 0.88)' : 'rgba(11, 16, 32, 0.9)'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = locked ? '#34d399' : 'rgba(168, 85, 247, 0.7)'
    ctx.stroke()
    ctx.fillStyle = locked ? '#ecfdf5' : '#f5e8ff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, midX, midY + 1)
  }
}

function drawChevron(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  bright: string,
  dim: string,
) {
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + w * 0.58, y)
  ctx.lineTo(x + w, y + h / 2)
  ctx.lineTo(x + w * 0.58, y + h)
  ctx.lineTo(x, y + h)
  ctx.lineTo(x + w * 0.42, y + h / 2)
  ctx.closePath()
  const grad = ctx.createLinearGradient(x, y, x + w, y)
  grad.addColorStop(0, dim)
  grad.addColorStop(0.45, bright)
  grad.addColorStop(1, dim)
  ctx.fillStyle = grad
  ctx.fill()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}
