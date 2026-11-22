import { duoOuterPreview } from '@/lib/duo-layout'

/**
 * Preview-only iOS chrome in the outer right band (no fill — app background shows through).
 * Island / clock / signal stay at the top so rail buttons can occupy the thumb zone.
 */
export function DuoStatusStrip() {
  if (!duoOuterPreview()) return null
  return (
    <div
      data-duo-status-strip
      aria-hidden
      className="pointer-events-none fixed inset-y-0 right-0 z-[120] flex w-[4.25rem] flex-col items-center bg-transparent pt-[max(0.65rem,var(--safe-top))]"
    >
      <div className="mt-1 h-[2.35rem] w-[1.15rem] rounded-full bg-[#1a2030]/80 ring-1 ring-white/12" />
      <div className="mt-2.5 size-[1.35rem] rounded-full bg-[#2a1f3d]/75 ring-1 ring-[#A855F7]/45" />
      <p className="mt-3 font-sans text-[0.62rem] font-semibold tabular-nums leading-none text-slate-300/90 [writing-mode:vertical-rl] rotate-180">
        9:41
      </p>
      <div className="mt-3 flex flex-col items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
        <span className="h-1.5 w-1.5 rounded-full bg-white/35" />
        <span className="h-1 w-1 rounded-full bg-white/20" />
      </div>
    </div>
  )
}
