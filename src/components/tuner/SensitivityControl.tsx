import { SENSITIVITY, SENSITIVITY_HELP, type Sensitivity } from '@/lib/sensitivity'
import { cn } from '@/lib/utils'

const LEVELS: Sensitivity[] = ['low', 'medium', 'high']

type SensitivityControlProps = {
  value: Sensitivity
  onChange: (value: Sensitivity) => void
}

export function SensitivityControl({
  value,
  onChange,
}: SensitivityControlProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#141A28]/70 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Sensitivity
        </p>
        <div className="grid grid-cols-3 gap-1">
          {LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => onChange(level)}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-xs font-semibold capitalize',
                value === level
                  ? 'bg-[#A855F7] text-white'
                  : 'bg-white/5 text-slate-300',
              )}
            >
              {level}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        {SENSITIVITY_HELP[value]} Green window is ±{SENSITIVITY[value].inTuneCents}{' '}
        cents.
      </p>
    </div>
  )
}
