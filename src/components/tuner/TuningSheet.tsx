import { ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { OverlayHost } from '@/components/SheetClose'
import { Button } from '@/components/ui/button'
import {
  configsForFamily,
  defaultTuningId,
  FAMILIES,
  familyOf,
  findConfig,
  findFamily,
  groupTunings,
  tuningsForInstrument,
  type FamilyId,
  type InstrumentId,
  type TuningPreset,
} from '@/lib/presets'
import { cn } from '@/lib/utils'

type Step = 'family' | 'tunings'

type TuningSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  current: TuningPreset
  instrumentId: InstrumentId
  customs: TuningPreset[]
  onConfirm: (next: { instrumentId: InstrumentId; presetId: string }) => void
  onCreate: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

function familyHasStringCounts(family: FamilyId): boolean {
  return family === 'guitar' || family === 'bass'
}

export function TuningSheet({
  open,
  onOpenChange,
  current,
  instrumentId,
  customs,
  onConfirm,
  onCreate,
  onEdit,
  onDelete,
}: TuningSheetProps) {
  const [step, setStep] = useState<Step>('family')
  const [draftFamily, setDraftFamily] = useState<FamilyId>(familyOf(instrumentId))
  const [draftConfig, setDraftConfig] = useState<InstrumentId>(instrumentId)
  const [draftPresetId, setDraftPresetId] = useState(current.id)

  useEffect(() => {
    if (!open) return
    setStep('family')
    setDraftFamily(familyOf(instrumentId))
    setDraftConfig(instrumentId)
    setDraftPresetId(current.id)
  }, [open, instrumentId, current.id])

  const stringCounts = familyHasStringCounts(draftFamily)
  const configs = configsForFamily(draftFamily)
  const tunings = useMemo(
    () => (step === 'tunings' ? tuningsForInstrument(draftConfig, customs) : []),
    [customs, draftConfig, step],
  )
  const grouped = useMemo(() => groupTunings(tunings), [tunings])
  const family = findFamily(draftFamily)
  const config = findConfig(draftConfig)

  const closeSheet = () => onOpenChange(false)

  const applyTuning = (presetId: string, nextInstrument?: InstrumentId) => {
    onConfirm({
      instrumentId: draftFamily === 'chromatic' ? 'chromatic' : (nextInstrument ?? draftConfig),
      presetId: draftFamily === 'chromatic' ? 'chromatic' : presetId,
    })
    closeSheet()
  }

  const enterTunings = (id: InstrumentId) => {
    setDraftConfig(id)
    if (current.config === id) {
      setDraftPresetId(current.id)
    } else {
      setDraftPresetId(defaultTuningId(id, customs))
    }
    setStep('tunings')
  }

  const chooseFamily = (id: FamilyId) => {
    setDraftFamily(id)
    if (id === 'chromatic') {
      applyTuning('chromatic', 'chromatic')
      return
    }
    if (familyHasStringCounts(id)) {
      if (familyOf(instrumentId) === id) {
        setDraftConfig(instrumentId)
        setDraftPresetId(current.id)
      } else {
        const first = configsForFamily(id)[0]
        setDraftConfig(first.id)
        setDraftPresetId(defaultTuningId(first.id, customs))
      }
      setStep('family')
      return
    }
    if (id === 'folk') {
      const next =
        familyOf(instrumentId) === 'folk' ? instrumentId : configsForFamily('folk')[0].id
      setDraftConfig(next)
      setDraftPresetId(
        familyOf(instrumentId) === 'folk' ? current.id : defaultTuningId(next, customs),
      )
      setStep('tunings')
      return
    }
    if (id === 'custom') {
      setDraftConfig('custom')
      setDraftPresetId(current.config === 'custom' ? current.id : defaultTuningId('custom', customs))
      setStep('tunings')
      return
    }
    const only = configsForFamily(id)[0]
    setDraftConfig(only.id)
    setDraftPresetId(
      current.config === only.id ? current.id : defaultTuningId(only.id, customs),
    )
    setStep('tunings')
  }

  const goBack = () => {
    if (step === 'tunings') {
      setStep('family')
      return
    }
    closeSheet()
  }

  if (!open) return null

  const title =
    step === 'tunings'
      ? draftFamily === 'folk'
        ? family.label
        : stringCounts
          ? `${family.label} · ${config.label}`
          : family.label
      : 'Tuning'

  return (
    <OverlayHost
      className="z-[70] items-end bg-black/70 sm:items-center"
      data-tuning-sheet
      data-tuning-step={step}
      onClick={closeSheet}
    >
      <div
        role="dialog"
        aria-labelledby="tuning-sheet-title"
        className="flex h-full max-h-[40rem] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0F1422] sm:h-auto sm:max-h-full sm:rounded-3xl md:max-w-2xl lg:max-w-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 px-4 pb-3 pt-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-tuning-back
              onClick={goBack}
              className="inline-flex shrink-0 items-center gap-0.5 text-sm font-semibold text-[#C084FC]"
            >
              <span aria-hidden>‹</span>
              Back
            </button>
            <h2
              id="tuning-sheet-title"
              className="min-w-0 text-wrap break-words text-lg font-bold tracking-tight text-white sm:text-xl"
            >
              {title}
            </h2>
          </div>

          {step === 'family' ? (
            <>
              <div className="mt-3 flex max-w-full flex-wrap gap-2">
                {FAMILIES.map((item) => {
                  const selected = item.id === draftFamily
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-tuning-family={item.id}
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

              {stringCounts ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {configs.map((item) => {
                    const selected = item.id === draftConfig
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-tuning-config={item.id}
                        onClick={() => enterTunings(item.id)}
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
            </>
          ) : null}
        </div>

        {step === 'tunings' ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
            {draftFamily === 'custom' ? (
              <CustomList
                items={tunings}
                selectedId={draftPresetId}
                onSelect={(id) => applyTuning(id, 'custom')}
                onEdit={onEdit}
                onDelete={onDelete}
                onCreate={onCreate}
              />
            ) : draftFamily === 'folk' ? (
              <FolkList
                selectedId={draftPresetId}
                onSelect={(preset) => applyTuning(preset.id, preset.config)}
              />
            ) : grouped.length === 0 ? (
              <p className="px-1 py-6 text-center text-sm text-slate-500">
                No tunings for this setup yet.
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
                        onSelect={() => applyTuning(preset.id)}
                      />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        ) : (
          <div className="min-h-0 flex-1" />
        )}

        <div className="flex shrink-0 border-t border-white/10 bg-[#0F1422] px-4 py-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            data-tuning-cancel
            onClick={closeSheet}
          >
            Cancel
          </Button>
        </div>
      </div>
    </OverlayHost>
  )
}

function FolkList({
  selectedId,
  onSelect,
}: {
  selectedId: string
  onSelect: (preset: TuningPreset) => void
}) {
  const sections = configsForFamily('folk').map((item) => ({
    config: item,
    groups: groupTunings(tuningsForInstrument(item.id, [])),
  }))

  return (
    <div>
      {sections.map((section) => (
        <section key={section.config.id} className="mb-5">
          <h3 className="sticky top-0 z-10 bg-[#0F1422] px-1 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#C084FC]">
            {section.config.label}
          </h3>
          {section.groups.map((group) => (
            <div key={group.category} className="mb-3">
              <p className="px-1 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((preset) => (
                  <TuningRow
                    key={preset.id}
                    preset={preset}
                    selected={preset.id === selectedId}
                    onSelect={() => onSelect(preset)}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
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
      data-tuning-row={preset.id}
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
