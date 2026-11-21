import { useEffect, useRef } from 'react'

import { FoldCrease, FoldHalf, FoldShell } from '@/components/fold/FoldShell'
import { FoldModeButton } from '@/components/fold/FoldModePicker'
import { A4ReferenceControl } from '@/components/tuner/A4ReferenceControl'
import { OmnicianWordmark } from '@/components/OmnicianMark'
import { FOLD_NEEDLE_REACH_PX, splitPegs } from '@/lib/fold-mode'
import { formatTenths } from '@/lib/feel'
import { formatHz } from '@/lib/notes'
import { cn } from '@/lib/utils'

export type FoldPeg = {
  id: string
  label: string
  octave: number
  stringNo: number
}

export function TunerBook({
  a4Hz,
  onA4,
  cents,
  inTune,
  live,
  noteName,
  octave,
  targetHz,
  detectedHz,
  pegs,
  selectedId,
  tunedIds,
  onPeg,
}: {
  a4Hz: number
  onA4: (hz: number) => void
  cents: number | null
  inTune: boolean
  live: boolean
  noteName: string | null
  octave: number | null
  targetHz: number | null
  detectedHz: number | null
  pegs: readonly FoldPeg[]
  selectedId: string | null
  tunedIds: ReadonlySet<string>
  onPeg: (peg: FoldPeg) => void
}) {
  const { left: leftPegs, right: rightPegs } = splitPegs(pegs)
  const letter = noteName?.replace(/\d+$/, '') ?? '—'
  const shownCents = cents

  return (
    <FoldShell layout="book">
      <FoldHalf side="left" className="px-4 pt-3">
        <div className="flex items-center gap-2">
          <OmnicianWordmark className="h-6 w-auto" />
          <A4ReferenceControl a4Hz={a4Hz} onChange={onA4} />
        </div>
        <p className="pointer-events-none absolute left-6 top-[9.5rem] text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Flat
        </p>
      </FoldHalf>
      <FoldHalf side="right" className="px-4 pt-3">
        <div className="flex justify-end pr-[5.6rem]">
          <FoldModeButton always />
        </div>
        <p className="pointer-events-none absolute right-[6.2rem] top-[9.5rem] text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Sharp
        </p>
      </FoldHalf>
      <FoldCrease axis="vertical" />

      <div className="pointer-events-none absolute inset-x-0 top-[140px] z-10 flex h-[140px] items-center justify-center">
        <span
          data-fold-note-letter
          className={cn(
            'absolute right-[calc(50%+16px)] text-[8.5rem] font-extrabold leading-none tracking-tight',
            inTune && live ? 'text-emerald-300' : live ? 'text-white' : 'text-white/30',
          )}
        >
          {letter}
        </span>
        <span
          data-fold-note-octave
          className={cn(
            'absolute left-[calc(50%+16px)] text-[8.5rem] font-extrabold leading-none tracking-tight text-slate-300',
            inTune && live && 'text-emerald-300/80',
          )}
        >
          {octave ?? ''}
        </span>
      </div>

      <div className="pointer-events-none absolute left-0 right-0 top-[300px] z-10 flex h-[70px] items-center justify-center gap-16 text-[1.35rem] font-semibold tabular-nums">
        <span
          className={cn(
            shownCents !== null && shownCents < 0 && live ? 'text-amber-300' : 'text-slate-400',
          )}
        >
          {live && shownCents !== null ? `${formatTenths(shownCents)} cents` : '— cents'}
        </span>
        <span className="w-8" aria-hidden />
        <span className="text-slate-400">{detectedHz ? formatHz(detectedHz) : targetHz ? formatHz(targetHz) : '—'}</span>
      </div>

      <BookScale cents={shownCents} inTune={inTune} live={live} />

      <div className="absolute left-[40px] top-[624px] z-20 flex h-[72px] w-[440px] items-center gap-2">
        {leftPegs.map((peg) => (
          <PegChip
            key={peg.id}
            peg={peg}
            selected={peg.id === selectedId}
            tuned={tunedIds.has(peg.id)}
            onPeg={onPeg}
          />
        ))}
      </div>
      <div className="absolute left-[544px] top-[624px] z-20 flex h-[72px] w-[380px] items-center gap-2 pr-2">
        {rightPegs.map((peg) => (
          <PegChip
            key={peg.id}
            peg={peg}
            selected={peg.id === selectedId}
            tuned={tunedIds.has(peg.id)}
            onPeg={onPeg}
          />
        ))}
      </div>
    </FoldShell>
  )
}

function PegChip({
  peg,
  selected,
  tuned,
  onPeg,
}: {
  peg: FoldPeg
  selected: boolean
  tuned: boolean
  onPeg: (peg: FoldPeg) => void
}) {
  return (
    <button
      type="button"
      data-fold-peg={peg.id}
      onClick={() => onPeg(peg)}
      className={cn(
        'flex h-[72px] min-h-10 min-w-0 flex-1 flex-col items-center justify-center rounded-2xl border touch-manipulation',
        selected ? 'border-[#A855F7] bg-[#A855F7]/15 text-white' : 'border-white/12 bg-[#141A28] text-slate-200',
        tuned && 'border-emerald-400/80 bg-emerald-500/15',
      )}
    >
      <span className="text-[1.15rem] font-bold leading-none">{peg.label}</span>
      <span className="mt-1 font-mono text-[0.65rem] text-slate-500">
        {peg.label}
        {peg.octave}
      </span>
    </button>
  )
}

function BookScale({
  cents,
  inTune,
  live,
}: {
  cents: number | null
  inTune: boolean
  live: boolean
}) {
  const needleRef = useRef<HTMLSpanElement>(null)
  const shownRef = useRef(0)
  const centsRef = useRef(cents)
  const liveRef = useRef(live)
  const inTuneRef = useRef(inTune)
  centsRef.current = cents
  liveRef.current = live
  inTuneRef.current = inTune

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const target = liveRef.current && centsRef.current !== null ? Math.max(-50, Math.min(50, centsRef.current)) : 0
      if (liveRef.current && centsRef.current !== null) {
        const delta = target - shownRef.current
        shownRef.current += delta * (Math.abs(delta) > 8 ? 0.48 : 0.34)
      } else {
        shownRef.current *= 0.9
      }
      const node = needleRef.current
      if (node) {
        const x = (shownRef.current / 50) * FOLD_NEEDLE_REACH_PX
        const inDead = Math.abs(x) < 16
        const showInDead = inTuneRef.current && Math.abs(shownRef.current) <= 1.05
        node.style.transform = `translateX(${x}px)`
        node.style.opacity = inDead && !showInDead ? '0' : liveRef.current ? '1' : '0.35'
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const marks = [-50, -40, -30, -20, -10, 10, 20, 30, 40, 50]

  return (
    <div
      data-fold-tuner-scale
      className="absolute left-[104px] top-[400px] z-10 h-[90px] w-[816px]"
    >
      <div className="absolute inset-x-0 top-[28px] h-px bg-white/25" />
      {marks.map((mark) => (
        <span
          key={mark}
          className="absolute top-[18px] w-px -translate-x-1/2 bg-white/35"
          style={{ left: `${50 + (mark / 50) * 50}%`, height: Math.abs(mark) % 20 === 0 ? 22 : 12 }}
        />
      ))}
      {marks.filter((mark) => Math.abs(mark) >= 10).map((mark) => (
        <span
          key={`l${mark}`}
          className="absolute top-[52px] -translate-x-1/2 text-[0.62rem] tabular-nums text-slate-500"
          style={{ left: `${50 + (mark / 50) * 50}%` }}
        >
          {mark > 0 ? `+${mark}` : mark}
        </span>
      ))}
      <span
        className={cn(
          'absolute left-1/2 top-[10px] h-10 w-px -translate-x-1/2',
          inTune && live ? 'bg-emerald-300' : 'bg-[#A855F7]/70',
        )}
      />
      <span
        ref={needleRef}
        data-fold-tuner-needle
        className={cn(
          'absolute left-1/2 top-0 z-10 h-[54px] w-[3px] -translate-x-1/2 rounded-full',
          inTune && live ? 'bg-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.85)]' : 'bg-amber-300',
        )}
      />
    </div>
  )
}
