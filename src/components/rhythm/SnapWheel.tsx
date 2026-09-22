import { useLayoutEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

type SnapWheelProps<T extends string | number> = {
  values: readonly T[]
  value: T
  onChange: (value: T) => void
  format?: (value: T) => string
  label: string
  wide?: boolean
  compact?: boolean
}

const ITEM_COMFORT = 40
const ITEM_COMPACT = 32

export function SnapWheel<T extends string | number>({
  values,
  value,
  onChange,
  format,
  label,
  wide = false,
  compact = false,
}: SnapWheelProps<T>) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const fromScrollRef = useRef(false)
  const readyRef = useRef(false)
  const ignoreUntilRef = useRef(0)
  const itemSize = compact ? ITEM_COMPACT : ITEM_COMFORT
  const index = Math.max(0, values.indexOf(value))

  useLayoutEffect(() => {
    const node = scrollerRef.current
    if (!node) return
    fromScrollRef.current = true
    ignoreUntilRef.current = performance.now() + 180
    node.scrollTop = index * itemSize
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        fromScrollRef.current = false
        readyRef.current = true
      })
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [index, itemSize, value])

  return (
    <div className={cn('flex flex-col items-center', wide ? 'w-24' : compact ? 'w-16' : 'w-[4.5rem]')}>
      <p className="mb-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0B0F1A]',
          compact ? 'h-[96px]' : 'h-[120px]',
        )}
      >
        <div
          className={cn(
            'pointer-events-none absolute inset-x-1 z-10 rounded-xl bg-[#A855F7]/18 ring-1 ring-[#A855F7]/40',
            compact ? 'top-8 h-8' : 'top-10 h-10',
          )}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-7 bg-gradient-to-b from-[#0B0F1A] to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-7 bg-gradient-to-t from-[#0B0F1A] to-transparent" />
        <div
          ref={scrollerRef}
          className={cn(
            'h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            compact ? 'py-8' : 'py-10',
          )}
          onScroll={(event) => {
            if (!readyRef.current || fromScrollRef.current) return
            if (performance.now() < ignoreUntilRef.current) return
            const next = Math.round(event.currentTarget.scrollTop / itemSize)
            const clamped = Math.min(values.length - 1, Math.max(0, next))
            const chosen = values[clamped]
            if (chosen !== undefined && chosen !== value) {
              fromScrollRef.current = true
              onChange(chosen)
            }
          }}
        >
          {values.map((item) => (
            <button
              key={String(item)}
              type="button"
              onClick={() => onChange(item)}
              className={cn(
                'flex w-full shrink-0 snap-center items-center justify-center text-sm font-semibold',
                compact ? 'h-8' : 'h-10',
                item === value ? 'text-white' : 'text-slate-500',
              )}
            >
              {format ? format(item) : String(item)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
