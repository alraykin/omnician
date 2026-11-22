import { useState, type ReactNode } from 'react'
import { Plus, Trash2, Undo2 } from 'lucide-react'

import { OverlayHost, SheetHeader } from '@/components/SheetClose'
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
  canSaveDefault,
  canUndo,
  saving,
  error,
  notice,
  displayName,
  onStyle,
  onNew,
  onDelete,
  onSaveDefault,
  onUndo,
  onHistory,
  onSignOut,
  onOpenSaveNew,
  onOpenRename,
}: {
  library: FactoryLibrary
  selectedId: string | null
  name: string
  styleId: RhythmStyleId
  dirty: boolean
  canSaveDefault: boolean
  canUndo: boolean
  saving: boolean
  error: string | null
  notice: string | null
  displayName: string
  onStyle: (styleId: RhythmStyleId) => void
  onNew: () => void
  onDelete: () => void
  onSaveDefault: () => void
  onUndo: () => void
  onHistory: () => void
  onSignOut: () => void
  onOpenSaveNew: () => void
  onOpenRename: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const shownName = name || displayName || 'Custom beat'
  const styleCount = library.styles.find((item) => item.id === styleId)?.beats.length ?? 0

  return (
    <section
      data-factory-bar
      data-factory-dirty={dirty ? 'true' : 'false'}
      data-factory-name-value={shownName}
      data-factory-selected={selectedId ?? ''}
      data-factory-style-count={styleCount}
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
      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <p data-factory-current-name className="min-w-0 truncate text-sm font-semibold text-white">
          {shownName}
        </p>
        <p
          data-factory-unsaved={dirty ? 'true' : 'false'}
          className={cn('shrink-0 text-[0.65rem] font-semibold', dirty ? 'text-[#F5D0FE]' : 'text-slate-500')}
        >
          {dirty ? 'Unsaved changes' : 'Saved'}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
        <button
          type="button"
          data-factory-undo
          aria-label="Undo last save"
          disabled={!canUndo || saving}
          onClick={onUndo}
          className={cn(
            'inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-[#0B0F1A] px-2.5 text-xs font-semibold text-white',
            (!canUndo || saving) && 'opacity-40',
          )}
        >
          <Undo2 className="size-3.5" />
          Undo
        </button>
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
          <IconBtn label="Delete factory beat" onClick={() => setConfirmDelete(true)} disabled={!canSaveDefault}>
            <Trash2 className="size-4" />
          </IconBtn>
        )}
        <button
          type="button"
          data-factory-history-open
          onClick={onHistory}
          className="h-8 rounded-lg px-2 text-xs font-semibold text-slate-400 hover:text-white"
        >
          History
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-factory-rename
          disabled={!canSaveDefault}
          onClick={onOpenRename}
          className="h-8 px-2.5 text-xs"
        >
          Rename
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-factory-save-as-new
          disabled={saving}
          onClick={onOpenSaveNew}
          className="h-8 px-2.5 text-xs"
        >
          Save as new
        </Button>
        <Button
          type="button"
          size="sm"
          data-factory-save
          disabled={saving || !canSaveDefault}
          onClick={onSaveDefault}
          className="ml-auto h-8 px-2.5 text-xs"
        >
          {saving ? 'Saving…' : 'Save as default'}
        </Button>
      </div>
      {notice ? (
        <p data-factory-notice className="mt-2 text-xs font-semibold text-emerald-300">
          {notice}
        </p>
      ) : null}
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

export function FactoryNameSheet({
  mode,
  name,
  styleId,
  saving,
  onClose,
  onSubmit,
}: {
  mode: 'save-new' | 'rename'
  name: string
  styleId: RhythmStyleId
  saving: boolean
  onClose: () => void
  onSubmit: (name: string, styleId: RhythmStyleId) => void
}) {
  const [draftName, setDraftName] = useState(name)
  const [draftStyle, setDraftStyle] = useState(styleId)
  const title = mode === 'save-new' ? 'Save as new factory beat' : 'Rename factory beat'
  return (
    <OverlayHost className="z-[70] items-end bg-black/70 sm:items-center">
      <form
        role="dialog"
        aria-labelledby="factory-name-title"
        data-factory-name-dialog={mode}
        className="relative z-10 w-full max-w-sm overflow-y-auto rounded-3xl border border-white/10 bg-[#0F1422] p-5"
        onSubmit={(event) => {
          event.preventDefault()
          if (!draftName.trim()) return
          onSubmit(draftName.trim(), draftStyle)
        }}
      >
        <SheetHeader
          titleId="factory-name-title"
          title={title}
          onClose={onClose}
          closeLabel="Close factory name"
          description={
            <p className="mt-1 text-sm text-pretty text-slate-400">
              {mode === 'save-new'
                ? 'Adds a new built-in beat with the current pattern. The one you loaded stays as it was last saved.'
                : 'Changes the name of this factory beat. It keeps the same id.'}
            </p>
          }
        />
        <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Name
          <input
            autoFocus
            value={draftName}
            maxLength={40}
            placeholder="Name this beat"
            data-factory-name-input
            onChange={(event) => setDraftName(event.target.value)}
            className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-white outline-none focus:border-[#A855F7]"
          />
        </label>
        {mode === 'save-new' ? (
          <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Style
            <select
              data-factory-new-style
              value={draftStyle}
              onChange={(event) => setDraftStyle(event.target.value as RhythmStyleId)}
              className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-white"
            >
              {FACTORY_STYLE_IDS.map((id) => (
                <option key={id} value={id}>
                  {findStyle(id)?.name ?? id}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <Button type="submit" className="mt-4 w-full" disabled={saving || !draftName.trim()} data-factory-name-confirm>
          {mode === 'save-new' ? 'Save as new' : 'Rename'}
        </Button>
        <Button type="button" variant="outline" className="mt-2 w-full" onClick={onClose}>
          Cancel
        </Button>
      </form>
    </OverlayHost>
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
    <OverlayHost className="z-[70] items-end bg-black/70 sm:items-center">
      <div
        role="dialog"
        aria-labelledby="factory-history-title"
        data-factory-history
        className="max-h-full w-full max-w-sm overflow-y-auto rounded-3xl border border-white/10 bg-[#0F1422] p-5"
      >
        <SheetHeader
          titleId="factory-history-title"
          title="Version history"
          onClose={onClose}
          closeLabel="Close version history"
          description={
            <p className="mt-1 text-sm text-pretty text-slate-400">
              Undo on the editor bar steps back one save. Pick an older save here if you need it.
            </p>
          }
        />
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
    </OverlayHost>
  )
}
