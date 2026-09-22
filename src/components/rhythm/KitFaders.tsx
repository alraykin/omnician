import {
  KIT_GROUPS,
  KIT_GROUP_LABELS,
  formatKitDb,
  mixDbToPos,
  mixPosToDb,
  type KitGroupId,
  type KitMix,
} from '@/lib/kit-mix'

type KitFadersProps = {
  mix: KitMix
  onChange: (group: KitGroupId, db: number) => void
}

export function KitFaders({ mix, onChange }: KitFadersProps) {
  return (
    <div data-section="kit-faders" className="mt-2 grid grid-cols-4 gap-1.5">
      {KIT_GROUPS.map((group) => {
        const db = mix[group]
        return (
          <label
            key={group}
            className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-[#141A28]/80 px-1 py-1.5"
          >
            <span className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {KIT_GROUP_LABELS[group]}
            </span>
            <input
              type="range"
              min={0}
              max={1000}
              step={1}
              value={Math.round(mixDbToPos(db) * 1000)}
              aria-label={`${KIT_GROUP_LABELS[group]} level`}
              data-kit-fader={group}
              onChange={(event) => onChange(group, mixPosToDb(Number(event.target.value) / 1000))}
              className="kit-fader"
            />
            <span className="text-[0.58rem] font-semibold tabular-nums text-slate-500">
              {formatKitDb(db)}
            </span>
          </label>
        )
      })}
    </div>
  )
}
