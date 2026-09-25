import { memo, useCallback, useRef, type PointerEvent } from 'react'

import { VOICE_LABELS, VOICES, type VoiceId } from '@/lib/rhythm'
import { cn } from '@/lib/utils'

type DrumGridPattern = Record<VoiceId, boolean[]>

type DrumGridProps = {
  beats: number
  subdivisionSteps: number
  pattern: DrumGridPattern
  currentStep: number
  live: boolean
  onPaint: (voice: VoiceId, step: number, on: boolean, preview: boolean) => void
  onPreview: (voice: VoiceId) => void
}

type PaintStroke = {
  voice: VoiceId
  on: boolean
  lastKey: string
}

function readCell(node: Element | null): { voice: VoiceId; step: number; on: boolean } | null {
  const cell = node?.closest('[data-grid-cell]')
  if (!cell) return null
  const voice = cell.getAttribute('data-voice-cell')
  const step = Number(cell.getAttribute('data-step'))
  if (!voice || !Number.isInteger(step)) return null
  return { voice: voice as VoiceId, step, on: cell.getAttribute('aria-pressed') === 'true' }
}

function cellFromPoint(x: number, y: number) {
  return readCell(document.elementFromPoint(x, y))
}

export const DrumGrid = memo(function DrumGrid({
  beats,
  subdivisionSteps,
  pattern,
  currentStep,
  live,
  onPaint,
  onPreview,
}: DrumGridProps) {
  const steps = beats * subdivisionSteps
  const minCell =
    subdivisionSteps >= 6
      ? 'clamp(1.15rem, 2.4vw, 1.7rem)'
      : subdivisionSteps >= 4
        ? 'clamp(1.3rem, 2.8vw, 2rem)'
        : 'clamp(1.45rem, 3.2vw, 2.25rem)'
  const paintRef = useRef<PaintStroke | null>(null)
  const pointerPaintedRef = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const paintAt = useCallback(
    (voice: VoiceId, step: number, preview: boolean) => {
      const stroke = paintRef.current
      if (!stroke || stroke.voice !== voice) return
      const key = `${voice}:${step}`
      if (stroke.lastKey === key) return
      stroke.lastKey = key
      onPaint(voice, step, stroke.on, preview)
    },
    [onPaint],
  )

  const endPaint = useCallback(() => {
    paintRef.current = null
  }, [])

  const startPaint = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      const cell = readCell(event.target instanceof Element ? event.target : null)
      if (!cell) return
      event.preventDefault()
      pointerPaintedRef.current = true
      rootRef.current?.setPointerCapture(event.pointerId)
      paintRef.current = { voice: cell.voice, on: !cell.on, lastKey: '' }
      paintAt(cell.voice, cell.step, true)
    },
    [paintAt],
  )

  return (
    <div
      ref={rootRef}
      data-drum-grid
      className="max-h-[min(48vh,26rem)] overflow-x-auto overflow-y-auto pb-1 md:max-h-[min(56vh,34rem)] lg:max-h-none"
      onPointerDown={startPaint}
      onClick={(event) => {
        if (pointerPaintedRef.current) {
          pointerPaintedRef.current = false
          event.preventDefault()
          return
        }
        const cell = readCell(event.target instanceof Element ? event.target : null)
        if (!cell) return
        onPaint(cell.voice, cell.step, !cell.on, true)
      }}
      onPointerMove={(event) => {
        if (!paintRef.current || event.buttons === 0) return
        const cell = cellFromPoint(event.clientX, event.clientY)
        if (cell) paintAt(cell.voice, cell.step, false)
      }}
      onPointerCancel={endPaint}
      onPointerUp={endPaint}
    >
      <div
        className="min-w-full"
        style={{ minWidth: `calc(3.6rem + ${beats} * ${subdivisionSteps} * ${minCell})` }}
      >
        <div className="mb-1.5 flex items-center gap-1 pl-[3.55rem] text-[0.6rem] font-semibold uppercase tracking-wider text-slate-500">
          {Array.from({ length: beats }, (_, beat) => (
            <span
              key={`beat-${beat}`}
              className="text-center"
              style={{ flex: subdivisionSteps, minWidth: `calc(${subdivisionSteps} * ${minCell})` }}
            >
              {beat + 1}
            </span>
          ))}
        </div>

        <div className="space-y-0.5">
          {VOICES.map((voice) => (
            <div key={voice} className="flex items-center gap-1">
              <button
                type="button"
                data-voice={voice}
                onClick={() => onPreview(voice)}
                className="w-[3.45rem] shrink-0 truncate rounded-lg px-0.5 py-1 text-left text-[0.65rem] font-semibold leading-tight text-slate-300 hover:bg-white/6 hover:text-white lg:w-16 lg:text-xs"
              >
                {VOICE_LABELS[voice]}
              </button>
              <div className="flex min-w-0 flex-1 touch-none gap-1">
                {Array.from({ length: beats }, (_, beat) => (
                  <div key={`${voice}-${beat}`} className="flex gap-px" style={{ flex: subdivisionSteps }}>
                    {Array.from({ length: subdivisionSteps }, (_, offset) => {
                      const step = beat * subdivisionSteps + offset
                      if (step >= steps) return null
                      return (
                        <DrumCell
                          key={step}
                          voice={voice}
                          step={step}
                          beat={beat}
                          offset={offset}
                          on={Boolean(pattern[voice]?.[step])}
                          now={live && currentStep === step}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})

const DrumCell = memo(function DrumCell({
  voice,
  step,
  beat,
  offset,
  on,
  now,
}: {
  voice: VoiceId
  step: number
  beat: number
  offset: number
  on: boolean
  now: boolean
}) {
  return (
    <button
      type="button"
      data-grid-cell
      data-voice-cell={voice}
      data-step={step}
      aria-pressed={on}
      aria-label={`${VOICE_LABELS[voice]}, beat ${beat + 1}, slot ${offset + 1}${on ? ', on' : ', off'}`}
      className={cn(
        'h-6 min-w-[1.05rem] flex-1 touch-none rounded-md border sm:h-7 md:h-8 lg:h-9',
        on ? 'border-[#A855F7] bg-[#A855F7]' : offset === 0 ? 'border-white/14 bg-white/8' : 'border-white/8 bg-white/4',
        now && 'ring-2 ring-white/80 ring-offset-1 ring-offset-[#0B0F1A]',
      )}
    />
  )
})
