import { type CSSProperties, type Ref } from 'react'

import { type InputDivision } from '@/lib/beat-boxes'
import { countMark, PLAYHEAD_COLOR, type GridLineKind } from '@/lib/drum-flat-grid'
import { cn } from '@/lib/utils'

export function HitDiamond({
  soft,
  hide,
  className,
  style,
}: {
  soft: boolean
  hide?: boolean
  className?: string
  style?: CSSProperties
}) {
  return (
    <span
      data-hit-dot
      data-hit-diamond
      data-hit-align="line"
      data-soft={soft ? '1' : '0'}
      {...(hide ? { 'data-move-hide': '1' } : {})}
      className={cn('drum-hit-diamond', className)}
      style={style}
    />
  )
}

export function PlayheadLine({
  lineRef,
  mark,
}: {
  lineRef?: Ref<HTMLDivElement>
  mark: 'editor' | 'grid'
}) {
  return (
    <div
      ref={lineRef}
      {...(mark === 'editor' ? { 'data-editor-playhead': '' } : { 'data-grid-playhead': '' })}
      hidden
      className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-[#FF4D6D]"
      style={{ left: 0, background: PLAYHEAD_COLOR }}
    >
      <span
        data-playhead-cap
        className="absolute left-1/2 top-0 z-30 -translate-x-1/2 border-x-[5px] border-t-[7px] border-x-transparent"
        style={{ borderTopColor: PLAYHEAD_COLOR }}
      />
    </div>
  )
}

export function CountStrip({
  beats,
  input,
  beatOffset = 0,
  columns,
}: {
  beats: number
  input: InputDivision
  beatOffset?: number
  columns?: number
}) {
  const cols = Math.max(beats, columns ?? beats)
  return (
    <div
      data-count-strip
      className="grid h-[1.25rem] min-w-0 items-end pb-0.5"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: beats }, (_, index) => {
        const beat = beatOffset + index
        return (
          <div key={beat} data-count-beat={beat + 1} className="flex min-w-0">
            {Array.from({ length: input }, (_, slot) => {
              const mark = countMark(beat, slot, input)
              return (
                <span
                  key={slot}
                  data-count={mark.kind}
                  {...(slot === 0 ? { 'data-beat-label': beat + 1 } : {})}
                  className={cn(
                    'min-w-0 flex-1 truncate text-left text-[0.62rem] font-semibold tabular-nums leading-none text-slate-200',
                    slot === 0 ? 'pl-0.5' : 'text-transparent',
                  )}
                >
                  {mark.text}
                </span>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

export function gridLineProps(
  kind: GridLineKind,
  barEnd: boolean,
): { 'data-grid-line': GridLineKind; 'data-grid-end'?: 'bar' } {
  return barEnd ? { 'data-grid-line': kind, 'data-grid-end': 'bar' } : { 'data-grid-line': kind }
}
