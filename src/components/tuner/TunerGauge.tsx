import { Check } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

type TunerGaugeProps = {
  cents: number | null
  inTune: boolean
  active: boolean
}

type Proximity = 'idle' | 'far' | 'closer' | 'near' | 'lock'

function proximityOf(absCents: number, active: boolean, inTune: boolean): Proximity {
  if (!active) return 'idle'
  if (inTune) return 'lock'
  if (absCents > 26) return 'far'
  if (absCents > 14) return 'closer'
  return 'near'
}

function needleColor(proximity: Proximity): string {
  if (proximity === 'lock') return '#34d399'
  if (proximity === 'near') return '#a3e635'
  if (proximity === 'closer') return '#fbbf24'
  if (proximity === 'far') return '#e2e8f0'
  return 'rgba(255,255,255,0.35)'
}

export function TunerGauge({ cents, inTune, active }: TunerGaugeProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const needleRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const trailRef = useRef<SVGGElement>(null)
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
          ? shownRef.current * 0.86
          : Math.max(-50, Math.min(50, targetCents))

      const delta = target - shownRef.current
      const catchUp = Math.abs(delta) > 22 ? 0.22 : locked ? 0.09 : 0.13
      shownRef.current += delta * catchUp
      if (locked) {
        shownRef.current += (0 - shownRef.current) * 0.08
      }
      if (Math.abs(shownRef.current) < 0.08) shownRef.current = 0

      const shown = shownRef.current
      const left = ((shown + 50) / 100) * 100
      const proximity = proximityOf(Math.abs(shown), live && targetCents !== null, locked)
      const color = needleColor(proximity)

      if (needleRef.current) {
        needleRef.current.style.left = `calc(${left}% - 2px)`
        needleRef.current.style.background = color
        needleRef.current.style.boxShadow =
          proximity === 'lock'
            ? '0 0 18px rgba(52, 211, 153, 0.9)'
            : proximity === 'near'
              ? '0 0 12px rgba(163, 230, 53, 0.45)'
              : 'none'
      }

      if (glowRef.current) {
        glowRef.current.style.opacity = proximity === 'lock' ? '1' : '0.28'
      }

      if (now - lastTrail > 32) {
        lastTrail = now
        const history = historyRef.current
        if (live && targetCents !== null) {
          history.push(shown)
          if (history.length > 18) history.shift()
        } else if (history.length > 0) {
          history.shift()
        }

        const group = trailRef.current
        const track = trackRef.current
        if (group && track) {
          const width = track.clientWidth
          const midY = 22
          group.replaceChildren()
          history.forEach((value, index) => {
            const x = ((value + 50) / 100) * width
            const opacity = ((index + 1) / history.length) * 0.42
            const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
            dot.setAttribute('cx', String(x))
            dot.setAttribute('cy', String(midY))
            dot.setAttribute('r', index === history.length - 1 ? '2.4' : '1.8')
            dot.setAttribute('fill', color)
            dot.setAttribute('opacity', String(opacity))
            group.appendChild(dot)
          })
        }
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="w-full" aria-hidden>
      <div className="relative mx-auto h-[5.5rem] w-full max-w-md">
        <div className="absolute inset-x-0 top-5 flex justify-between px-0.5 text-[0.65rem] font-medium uppercase tracking-wider text-slate-500">
          <span>Flat</span>
          <span>In tune</span>
          <span>Sharp</span>
        </div>

        <div ref={trackRef} className="absolute inset-x-0 top-10 h-11">
          <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-white/10" />
          <div
            ref={glowRef}
            className="absolute left-1/2 top-1/2 h-6 w-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/20 ring-1 ring-emerald-400/40 transition-opacity"
          />
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
            <g ref={trailRef} />
          </svg>
          <div
            ref={needleRef}
            className="absolute top-0 h-11 w-1 rounded-full"
            style={{ left: 'calc(50% - 2px)', background: 'rgba(255,255,255,0.35)' }}
          />
        </div>

        <div
          className={cn(
            'absolute left-1/2 top-0 flex size-7 -translate-x-1/2 items-center justify-center rounded-full',
            inTune && active
              ? 'omni-in-tune-pop bg-emerald-400 text-[#06281c]'
              : 'bg-transparent text-transparent',
          )}
        >
          <Check className="size-4 stroke-[3]" />
        </div>
      </div>
    </div>
  )
}
