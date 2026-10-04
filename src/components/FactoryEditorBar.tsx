import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp, History, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FACTORY_STYLE_IDS, type FactoryLibrary } from '@/lib/factory-library'
import { factoryLogout } from '@/lib/factory-store'
import { findStyle, type RhythmStyleId } from '@/lib/rhythm-presets'
import { cn } from '@/lib/utils'

export function FactoryEditorBar({
  library,
  selectedId,
  name,
  styleId,
  dirty,
  saving,
  error,
  onName,
  onStyle,
  onMove,
  onNew,
  onDelete,
  onSave,
  onHistory,
  onSignOut,
}: {
  library: FactoryLibrary
  selectedId: string | null
  name: string
  styleId: RhythmStyleId
  dirty: boolean
  saving: boolean
  error: string | null
  onName: (name: string) => void
  onStyle: (styleId: RhythmStyleId) => void
  onMove: (delta: number) => void
  onNew: () => void
  onDelete: () => void
  onSave: () => void
  onHistory: () => void
  onSignOut: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const style = library.styles.find((item) => item.id === styleId)
  const index = style?.beats.findIndex((beat) => beat.id === selectedId) ?? -1

  return (
    <section
      data-factory-bar
      className="mb-3 rounded-2xl border border-[#A855F7]/40 bg-[#A855F7]/12 px-3 py-2.5"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#E9D5FF]">Factory editor</p>
        <button
          type="button"
          className="text-[0.7rem] font-semibold text-slate-400 hover:text-white"
          onClick={() => {
            void factoryLogout()
            onSignOut()
          }}
        >
          Sign out
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          data-factory-name
          value={name}
          onChange={(event) => onName(event.target.value)}
          className="h-8 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0B0F1A] px-2 text-sm font-semibold text-white outline-none focus:border-[#A855F7]"
        />
        <select
          data-factory-style
          value={styleId}
          onChange={(event) => onStyle(event.target.value as RhythmStyleId)}
          className="h-8 rounded-lg border border-white/10 bg-[#0B0F1A] px-2 text-xs font-semibold text-white"
        >
          {FACTORY_STYLE_IDS.map((id) => (
            <option key={id} value={id}>
              {findStyle(id)?.name ?? id}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <IconBtn label="Move up" onClick={() => onMove(-1)} disabled={index <= 0}>
          <ChevronUp className="size-4" />
        </IconBtn>
        <IconBtn label="Move down" onClick={() => onMove(1)} disabled={index < 0 || !style || index >= style.beats.length - 1}>
          <ChevronDown className="size-4" />
        </IconBtn>
        <IconBtn label="New factory beat" onClick={onNew}>
          <Plus className="size-4" />
        </IconBtn>
        {confirmDelete ? (
          <button
            type="button"
            data-factory-delete-confirm
            className="h-8 rounded-lg bg-red-500 px-2 text-xs font-semibold text-white"
            onClick={() => {
              setConfirmDelete(false)
              onDelete()
            }}
          >
            Delete this beat?
          </button>
        ) : (
          <IconBtn label="Delete factory beat" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" />
          </IconBtn>
        )}
        <IconBtn label="Version history" onClick={onHistory}>
          <History className="size-4" />
        </IconBtn>
        <Button
          type="button"
          size="sm"
          data-factory-save
          disabled={saving || !dirty}
          onClick={onSave}
          className="ml-auto h-8 px-2.5 text-xs"
        >
          {saving ? 'Saving…' : 'Save as default'}
        </Button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </section>
  )
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex size-8 items-center justify-center rounded-lg border border-white/10 bg-[#0B0F1A] text-slate-200',
        disabled && 'opacity-40',
      )}
    >
      {children}
    </button>
  )
}

export function FactoryHistorySheet({
  versions,
  onClose,
  onRestore,
}: {
  versions: Array<{ id: string; savedAt: string; beatCount: number }>
  onClose: () => void
  onRestore: (id: string) => void
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div
        role="dialog"
        aria-labelledby="factory-history-title"
        data-factory-history
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0F1422] p-5"
      >
        <h2 id="factory-history-title" className="text-xl font-bold tracking-tight text-white">
          Restore previous version
        </h2>
        <p className="mt-1 text-sm text-slate-400">The last 20 saves are kept on the server.</p>
        {versions.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-white/10 px-3 py-3 text-sm text-slate-500">
            No previous versions yet. Save as default to create one.
          </p>
        ) : (
          <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto">
            {versions.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/4 px-3 py-2">
                <span>
                  <span className="block text-sm font-semibold text-white">
                    {new Date(item.savedAt).toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-500">{item.beatCount} beats</span>
                </span>
                <Button type="button" size="sm" data-factory-restore={item.id} onClick={() => onRestore(item.id)}>
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button type="button" variant="outline" className="mt-4 w-full" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  )
}
