import { cn } from '@/lib/utils'

type TunerGaugeProps = {
  cents: number | null
  inTune: boolean
  active: boolean
}

export function TunerGauge({ cents, inTune, active }: TunerGaugeProps) {
  const clamped = cents === null ? 0 : Math.max(-50, Math.min(50, cents))
  const left = ((clamped + 50) / 100) * 100

  return (
    <div className="w-full" aria-hidden>
      <div className="relative mx-auto h-20 w-full max-w-md">
        <div className="absolute inset-x-0 top-10 h-2 rounded-full bg-white/10">
          <div className="absolute left-1/2 top-1/2 h-5 w-[18%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/25 ring-1 ring-emerald-400/40" />
        </div>
        <div className="absolute inset-x-0 top-6 flex justify-between px-0.5 text-[0.65rem] font-medium uppercase tracking-wider text-slate-500">
          <span>Flat</span>
          <span>In tune</span>
          <span>Sharp</span>
        </div>
        <div
          className={cn(
            'absolute top-6 h-10 w-1 rounded-full transition-[left,background-color] duration-75',
            !active && 'bg-white/25',
            active && inTune && 'bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.85)]',
            active && !inTune && 'bg-white',
          )}
          style={{ left: `calc(${left}% - 2px)` }}
        />
      </div>
    </div>
  )
}
