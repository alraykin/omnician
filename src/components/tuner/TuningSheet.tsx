import { ChevronRight, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { ChromaticCalibration } from '@/components/tuner/ChromaticCalibration'
import { Button } from '@/components/ui/button'
import {
  configsForFamily,
  defaultTuningId,
  FAMILIES,
  familyHasSubmenu,
  familyOf,
  findConfig,
  findFamily,
  groupTunings,
  matchesQuery,
  tuningsForInstrument,
  type FamilyId,
  type InstrumentId,
  type TuningPreset,
} from '@/lib/presets'
import { cn } from '@/lib/utils'

type TuningSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  current: TuningPreset
  instrumentId: InstrumentId
  customs: TuningPreset[]
  a4Hz: number
  onA4Change: (hz: number) => void
  onConfirm: (next: { instrumentId: InstrumentId; presetId: string }) => void
  onCreate: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export function TuningSheet({
  open,
  onOpenChange,
  current,
  instrumentId,
  customs,
  a4Hz,
  onA4Change,
  onConfirm,
  onCreate,
  onEdit,
  onDelete,
}: TuningSheetProps) {
  const [draftFamily, setDraftFamily] = useState<FamilyId>(familyOf(instrumentId))
  const [draftConfig, setDraftConfig] = useState<InstrumentId>(instrumentId)
  const [draftPresetId, setDraftPresetId] = useState(current.id)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) return
    setDraftFamily(familyOf(instrumentId))
    setDraftConfig(instrumentId)
    setDraftPresetId(current.id)
    setQuery('')
  }, [open, instrumentId, current.id])

  const submenu = familyHasSubmenu(draftFamily)
  const configs = configsForFamily(draftFamily)
  const lookingAtTunings = !submenu || configs.some((item) => item.id === draftConfig)
  const tunings = useMemo(
    () => (lookingAtTunings ? tuningsForInstrument(draftConfig, customs) : []),
    [customs, draftConfig, lookingAtTunings],
  )
  const visible = useMemo(
    () => tunings.filter((item) => matchesQuery(item, query)),
    [query, tunings],
  )
  const grouped = useMemo(() => groupTunings(visible), [visible])
  const family = findFamily(draftFamily)
  const config = findConfig(draftConfig)
  const canSelect =
    draftFamily === 'chromatic' ||
    (lookingAtTunings && visible.some((item) => item.id === draftPresetId))

  const chooseFamily = (id: FamilyId) => {
    setDraftFamily(id)
    setQuery('')
    const nextConfigs = configsForFamily(id)
    if (id === 'chromatic') {
      setDraftConfig('chromatic')
      setDraftPresetId('chromatic')
      return
    }
    if (id === 'custom') {
      setDraftConfig('custom')
      setDraftPresetId(current.config === 'custom' ? current.id : defaultTuningId('custom', customs))
      return
    }
    if (familyOf(instrumentId) === id) {
      setDraftConfig(instrumentId)
      setDraftPresetId(current.id)
      return
    }
    const first = nextConfigs[0]
    setDraftConfig(first.id)
    setDraftPresetId(defaultTuningId(first.id, customs))
  }

  const chooseConfig = (id: InstrumentId) => {
    setDraftConfig(id)
    setQuery('')
    if (current.config === id) {
      setDraftPresetId(current.id)
      return
    }
    setDraftPresetId(defaultTuningId(id, customs))
  }

  const confirm = () => {
    if (!canSelect) return
    onConfirm({
      instrumentId: draftFamily === 'chromatic' ? 'chromatic' : draftConfig,
      presetId: draftFamily === 'chromatic' ? 'chromatic' : draftPresetId,
    })
    onOpenChange(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-labelledby="tuning-sheet-title"
        className="flex h-[92svh] w-full max-w-lg flex-col rounded-t-3xl border border-white/10 bg-[#0F1422] sm:h-[min(40rem,90svh)] sm:rounded-3xl"
      >
        <div className="shrink-0 px-4 pb-3 pt-4">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#C084FC]">
            Tuning
          </p>
          <h2
            id="tuning-sheet-title"
            className="mt-1 text-xl font-bold tracking-tight text-white"
          >
            {submenu ? `${family.label} · ${config.label}` : family.label}
          </h2>

          <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FAMILIES.map((item) => {
              const selected = item.id === draftFamily
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => chooseFamily(item.id)}
                  className={cn(
                    'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap',
                    selected
                      ? 'bg-[#A855F7] text-white'
                      : 'bg-white/6 text-slate-300 ring-1 ring-white/10',
                  )}
                >
                  {item.label}
                </button>
              )
            })}
          </div>

          {submenu ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {configs.map((item) => {
                const selected = item.id === draftConfig
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => chooseConfig(item.id)}
                    className={cn(
                      'flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold',
                      selected
                        ? 'bg-[#A855F7]/20 text-white ring-1 ring-[#A855F7]/60'
                        : 'bg-white/5 text-slate-300 ring-1 ring-white/8',
                    )}
                  >
                    {item.label}
                    <ChevronRight className="size-4 text-slate-500" />
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
          {draftFamily === 'chromatic' ? (
            <ChromaticCalibration a4Hz={a4Hz} onChange={onA4Change} />
          ) : (
            <>
              <label className="relative mb-3 block">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search tunings or notes"
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[#A855F7]"
                />
              </label>

              {draftFamily === 'custom' ? (
                <CustomList
                  items={visible}
                  selectedId={draftPresetId}
                  onSelect={setDraftPresetId}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onCreate={onCreate}
                />
              ) : grouped.length === 0 ? (
                <p className="px-1 py-6 text-center text-sm text-slate-500">
                  {query ? `No tunings match “${query}”.` : 'Pick a configuration above.'}
                </p>
              ) : (
                grouped.map((group) => (
                  <section key={group.category} className="mb-4">
                    <h3 className="sticky top-0 z-10 bg-[#0F1422] px-1 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {group.label}
                    </h3>
                    <div className="space-y-1">
                      {group.items.map((preset) => (
                        <TuningRow
                          key={preset.id}
                          preset={preset}
                          selected={preset.id === draftPresetId}
                          onSelect={() => setDraftPresetId(preset.id)}
                        />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </>
          )}
        </div>

        <div className="sticky bottom-0 flex shrink-0 gap-2 border-t border-white/10 bg-[#0F1422] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={confirm}
            disabled={!canSelect}
          >
            Select
          </Button>
        </div>
      </div>
    </div>
  )
}

function TuningRow({
  preset,
  selected,
  onSelect,
  extra,
}: {
  preset: TuningPreset
  selected: boolean
  onSelect: () => void
  extra?: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-2xl px-2',
        selected && 'bg-[#A855F7]/18 ring-1 ring-[#A855F7]/50',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 px-2 py-2.5 text-left"
      >
        <span className="block text-sm font-semibold text-white">{preset.name}</span>
        <span className="block font-mono text-xs tracking-wide text-slate-400">
          {preset.notes}
        </span>
      </button>
      {extra}
    </div>
  )
}

function CustomList({
  items,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  onCreate,
}: {
  items: TuningPreset[]
  selectedId: string
  onSelect: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onCreate: () => void
}) {
  return (
    <div>
      <h3 className="px-1 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
        My presets
      </h3>
      {items.length === 0 ? (
        <p className="px-1 py-4 text-sm text-slate-500">
          None saved on this phone yet. Create one and it stays on this device.
        </p>
      ) : (
        <div className="space-y-1">
          {items.map((preset) => (
            <TuningRow
              key={preset.id}
              preset={preset}
              selected={preset.id === selectedId}
              onSelect={() => onSelect(preset.id)}
              extra={
                <span className="flex shrink-0 gap-1 pr-1">
                  <IconButton label={`Edit ${preset.name}`} onClick={() => onEdit(preset.id)}>
                    <Pencil className="size-3.5" />
                  </IconButton>
                  <IconButton
                    label={`Delete ${preset.name}`}
                    onClick={() => onDelete(preset.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </IconButton>
                </span>
              }
            />
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={onCreate}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#A855F7]/50 px-3 py-2.5 text-sm font-semibold text-[#C084FC]"
      >
        <Plus className="size-4" />
        New custom tuning
      </button>
    </div>
  )
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      {children}
    </Button>
  )
}
