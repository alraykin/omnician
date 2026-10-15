import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { BarMenu, type BarMenuAction } from '@/components/rhythm/BarMenu'
import { usePlayhead, type PlayheadStore } from '@/hooks/useRhythmEngine'
import { BAR_LONG_PRESS_MS, movedPastSlop } from '@/lib/bar-press'
import { HOLD_NUDGE_CLASS } from '@/lib/hold-repeat'
import { type RhythmBar } from '@/lib/rhythm'
import { activateOnPointer, cn } from '@/lib/utils'

export type BarChipMenu = {
  canPaste: boolean
  canDuplicate: boolean
  canDelete: boolean
  canAutoComplete: boolean
  canRetryFill: boolean
  onAction: (index: number, action: BarMenuAction) => void
}

export function BarStrip({
  store,
  bars,
  barIndex,
  playing,
  canAdd,
  onSelect,
  onAdd,
  onRemove,
  menu,
  tools,
}: {
  store: PlayheadStore
  bars: readonly RhythmBar[]
  barIndex: number
  playing: boolean
  canAdd: boolean
  onSelect: (index: number) => void
  onAdd: () => void
  onRemove: () => void
  menu?: BarChipMenu
  tools?: ReactNode
}) {
  const playhead = usePlayhead(store)
  const counting = playing && playhead.precount
  const active = barIndex
  const [menuAt, setMenuAt] = useState<{ index: number; x: number; y: number } | null>(null)
  const holdRef = useRef<number>(0)

  const openMenu = (index: number, x: number, y: number) => {
    setMenuAt({ index, x, y })
  }

  useEffect(() => {
    if (!menuAt) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuAt(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuAt])

  useEffect(() => {
    return () => window.clearTimeout(holdRef.current)
  }, [])

  return (
    <div data-bar-strip className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <p
          className="shrink-0 text-xs font-bold tabular-nums tracking-tight text-white sm:text-sm"
          data-bar-now={counting ? playhead.beat + 1 : active + 1}
          data-bar-total={bars.length}
          data-precount={counting ? 'true' : 'false'}
        >
          {counting && playhead.beat >= 0
            ? `Count ${playhead.beat + 1}`
            : `Bar ${active + 1} of ${bars.length}`}
        </p>
        <div data-bar-chips className="grid min-w-0 flex-1 grid-cols-8 gap-0.5">
          {bars.map((_, index) => {
            const live = playing && !playhead.precount && index === active
            const selected = index === active
            const chipClass = cn(
              HOLD_NUDGE_CLASS,
              'flex aspect-square min-h-6 w-full touch-manipulation items-center justify-center rounded-md text-[0.65rem] font-semibold tabular-nums sm:text-xs',
              selected ? 'bg-[#A855F7] text-white' : 'border border-white/10 bg-white/4 text-slate-200',
              live && 'omni-beat-pulse',
            )
            if (!menu) {
              return (
                <button
                  key={`bar-${index}`}
                  type="button"
                  data-bar-pill={index}
                  aria-label={`Bar ${index + 1} of ${bars.length}, ${
                    playing ? 'show this bar' : 'preview this bar'
                  }`}
                  aria-pressed={selected}
                  {...activateOnPointer(() => onSelect(index))}
                  className={chipClass}
                >
                  {index + 1}
                </button>
              )
            }
            return (
              <button
                key={`bar-${index}`}
                type="button"
                data-bar-pill={index}
                aria-label={`Bar ${index + 1} of ${bars.length}`}
                aria-haspopup="menu"
                aria-expanded={menuAt?.index === index}
                aria-pressed={selected}
                className={chipClass}
                onContextMenu={(event) => {
                  event.preventDefault()
                  onSelect(index)
                  openMenu(index, event.clientX, event.clientY)
                }}
                onPointerDown={(event) => {
                  if (event.button !== 0) return
                  const target = event.currentTarget
                  if (target.disabled) return
                  event.preventDefault()
                  const pointerId = event.pointerId
                  const startX = event.clientX
                  const startY = event.clientY
                  let opened = false
                  window.clearTimeout(holdRef.current)
                  const finish = (next: PointerEvent) => {
                    if (next.pointerId !== pointerId) return
                    window.removeEventListener('pointermove', onMove)
                    window.removeEventListener('pointerup', onUp)
                    window.removeEventListener('pointercancel', onUp)
                    window.clearTimeout(holdRef.current)
                    if (!opened && !movedPastSlop(startX, startY, next.clientX, next.clientY) && next.type === 'pointerup') {
                      onSelect(index)
                    }
                  }
                  const onMove = (next: PointerEvent) => {
                    if (next.pointerId !== pointerId) return
                    if (movedPastSlop(startX, startY, next.clientX, next.clientY)) {
                      window.clearTimeout(holdRef.current)
                    }
                  }
                  const onUp = finish
                  holdRef.current = window.setTimeout(() => {
                    opened = true
                    const rect = target.getBoundingClientRect()
                    onSelect(index)
                    openMenu(index, rect.left, rect.bottom + 6)
                  }, BAR_LONG_PRESS_MS)
                  window.addEventListener('pointermove', onMove)
                  window.addEventListener('pointerup', onUp)
                  window.addEventListener('pointercancel', onUp)
                }}
                onClick={(event) => {
                  if (event.detail === 0) onSelect(index)
                  else event.preventDefault()
                }}
              >
                {index + 1}
              </button>
            )
          })}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            aria-label="Add bar"
            disabled={!canAdd}
            {...activateOnPointer(onAdd)}
            className="flex size-6 touch-manipulation items-center justify-center rounded-md border border-white/12 text-slate-200 disabled:opacity-40 sm:size-7"
          >
            <Plus className="size-3.5" />
          </button>
          {bars.length > 1 ? (
            <button
              type="button"
              aria-label="Remove this bar"
              {...activateOnPointer(onRemove)}
              className="flex size-6 touch-manipulation items-center justify-center rounded-md text-slate-300 hover:bg-white/8 hover:text-white sm:size-7"
            >
              <Trash2 className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>
      {tools ? <div className="flex flex-wrap items-center gap-1">{tools}</div> : null}
      {menu && menuAt ? (
        <BarMenu
          x={menuAt.x}
          y={menuAt.y}
          canPaste={menu.canPaste}
          canDuplicate={menu.canDuplicate}
          canDelete={menu.canDelete}
          canAutoComplete={menu.canAutoComplete}
          canRetryFill={menu.canRetryFill}
          onClose={() => setMenuAt(null)}
          onAction={(action) => {
            menu.onAction(menuAt.index, action)
            setMenuAt(null)
          }}
        />
      ) : null}
    </div>
  )
}
