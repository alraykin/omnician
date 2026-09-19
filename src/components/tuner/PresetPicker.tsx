import type { ReactNode } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  GROUP_LABELS,
  GROUP_ORDER,
  type PresetGroup,
  type TuningPreset,
} from '@/lib/presets'
import { cn } from '@/lib/utils'

type PresetPickerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  current: TuningPreset
  builtins: TuningPreset[]
  customs: TuningPreset[]
  onSelect: (id: string) => void
  onCreate: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export function PresetPicker({
  open,
  onOpenChange,
  current,
  builtins,
  customs,
  onSelect,
  onCreate,
  onEdit,
  onDelete,
}: PresetPickerProps) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-[#141A28] px-4 py-3 text-left"
      >
        <span>
          <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#C084FC]">
            {GROUP_LABELS[current.group]}
          </span>
          <span className="mt-0.5 block text-sm font-semibold text-white">
            {current.name}
          </span>
          <span className="block text-xs text-slate-500">{current.summary}</span>
        </span>
        <span className="text-xs font-semibold text-slate-400">
          {open ? 'Close' : 'Change'}
        </span>
      </button>

      {open ? (
        <div className="absolute z-30 mt-2 max-h-[min(28rem,60svh)] w-full overflow-y-auto rounded-2xl border border-white/10 bg-[#101624] p-2 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)]">
          {GROUP_ORDER.map((group) => {
            const items =
              group === 'custom'
                ? customs
                : builtins.filter((preset) => preset.group === group)
            if (group === 'custom') {
              return (
                <GroupSection key={group} group={group}>
                  {items.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-slate-500">
                      None saved on this device yet.
                    </p>
                  ) : (
                    items.map((preset) => (
                      <PresetRow
                        key={preset.id}
                        preset={preset}
                        selected={preset.id === current.id}
                        onSelect={() => {
                          onSelect(preset.id)
                          onOpenChange(false)
                        }}
                        extra={
                          <span className="flex shrink-0 gap-1">
                            <IconButton
                              label={`Edit ${preset.name}`}
                              onClick={() => onEdit(preset.id)}
                            >
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
                    ))
                  )}
                  <button
                    type="button"
                    onClick={onCreate}
                    className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#A855F7]/50 px-3 py-2.5 text-sm font-semibold text-[#C084FC]"
                  >
                    <Plus className="size-4" />
                    New custom tuning
                  </button>
                </GroupSection>
              )
            }

            if (items.length === 0) return null
            return (
              <GroupSection key={group} group={group}>
                {items.map((preset) => (
                  <PresetRow
                    key={preset.id}
                    preset={preset}
                    selected={preset.id === current.id}
                    onSelect={() => {
                      onSelect(preset.id)
                      onOpenChange(false)
                    }}
                  />
                ))}
              </GroupSection>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function GroupSection({
  group,
  children,
}: {
  group: PresetGroup
  children: ReactNode
}) {
  return (
    <div className="mb-2">
      <p className="px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {GROUP_LABELS[group]}
      </p>
      {children}
    </div>
  )
}

function PresetRow({
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
        'flex items-center gap-2 rounded-xl px-2',
        selected && 'bg-[#A855F7]/15',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 px-2 py-2 text-left"
      >
        <span className="block text-sm font-semibold text-white">
          {preset.name}
        </span>
        <span className="block truncate text-xs text-slate-500">
          {preset.summary}
        </span>
      </button>
      {extra}
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
