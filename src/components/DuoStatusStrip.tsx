import { duoOuterPreview } from '@/lib/duo-layout'

/** Preview-only right-edge camera / status strip so screenshots match the Duo cover. */
export function DuoStatusStrip() {
  if (!duoOuterPreview()) return null
  return (
    <div
      data-duo-status-strip
      aria-hidden
      className="pointer-events-none fixed inset-y-0 right-0 z-[120] w-[2.125rem] bg-[#070A12]"
    >
      <div className="absolute right-[7px] top-10 h-16 w-[11px] rounded-full bg-[#1b2233] ring-1 ring-white/10" />
      <div className="absolute right-[9px] top-[4.6rem] size-1.5 rounded-full bg-[#C084FC]/70" />
    </div>
  )
}
