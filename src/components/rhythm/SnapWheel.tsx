import { useLayoutEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

type SnapWheelProps<T extends string | number> = {
  values: readonly T[]
  value: T
  onChange: (value: T) => void
  format?: (value: T) => string
  label: string
  wide?: boolean
}

const ITEM = 40

export function SnapWheel<T extends string | number>({
  values,
  value,
  onChange,
  format,
  label,
  wide = false,
}: SnapWheelProps<T>) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const fromScrollRef = useRef(false)
  const readyRef = useRef(false)
  const ignoreUntilRef = useRef(0)
  const index = Math.max(0, values.indexOf(value))

  useLayoutEffect(() => {
    const node = scrollerRef.current
    if (!node) return
    fromScrollRef.current = true
    ignoreUntilRef.current = performance.now() + 180
    node.scrollTop = index * ITEM
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
  }, [index, value])

  return (
    <div className={cn('flex flex-col items-center', wide ? 'w-24' : 'w-[4.5rem]')}>
      <p className="mb-1 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <div className="relative h-[120px] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0B0F1A]">
        <div className="pointer-events-none absolute inset-x-1 top-[40px] z-10 h-10 rounded-xl bg-[#A855F7]/18 ring-1 ring-[#A855F7]/40" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-8 bg-gradient-to-b from-[#0B0F1A] to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-8 bg-gradient-to-t from-[#0B0F1A] to-transparent" />
        <div
          ref={scrollerRef}
          className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain py-[40px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(event) => {
            if (!readyRef.current || fromScrollRef.current) return
            if (performance.now() < ignoreUntilRef.current) return
            const next = Math.round(event.currentTarget.scrollTop / ITEM)
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
                'flex h-10 w-full shrink-0 snap-center items-center justify-center text-sm font-semibold',
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
