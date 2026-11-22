import { useMemo, useState } from 'react'

import { OverlayHost, SheetHeader } from '@/components/SheetClose'
import { Button } from '@/components/ui/button'
import type { CustomTuning } from '@/lib/custom-presets'
import { SHARP_NAMES, midiFromNote, pitchClassName } from '@/lib/notes'

type CustomPresetEditorProps = {
  draft: CustomTuning | null
  onClose: () => void
  onSave: (draft: { id?: string; name: string; midis: number[] }) => string | null
}

const DEFAULT_MIDIS = [40, 45, 50, 55, 59, 64]
const OCTAVES = [0, 1, 2, 3, 4, 5, 6]

export function CustomPresetEditor({
  draft,
  onClose,
  onSave,
}: CustomPresetEditorProps) {
  const [name, setName] = useState(draft?.name ?? 'My tuning')
  const [midis, setMidis] = useState<number[]>(
    draft?.midis ?? [...DEFAULT_MIDIS],
  )
  const [error, setError] = useState('')

  const count = midis.length

  const rows = useMemo(
    () =>
      midis.map((midi, index) => {
        const pitch = pitchClassName(midi)
        return {
          index,
          stringNo: count - index,
          pitchClass: ((midi % 12) + 12) % 12,
          octave: pitch.octave,
        }
      }),
    [count, midis],
  )

  const setCount = (nextCount: number) => {
    const clamped = Math.max(4, Math.min(10, nextCount))
    setMidis((current) => {
      if (clamped === current.length) return current
      if (clamped < current.length) return current.slice(0, clamped)
      const extra = Array.from(
        { length: clamped - current.length },
        (_, offset) =>
          Math.min(96, current[current.length - 1] + 5 * (offset + 1)),
      )
      return [...current, ...extra]
    })
  }

  const setRow = (index: number, pitchClass: number, octave: number) => {
    setMidis((current) =>
      current.map((midi, row) =>
        row === index ? midiFromNote(pitchClass, octave) : midi,
      ),
    )
  }

  const save = () => {
    const id = onSave({ id: draft?.id, name, midis })
    if (!id) {
      setError('Give it a name and keep 4–10 strings.')
      return
    }
    onClose()
  }

  return (
    <OverlayHost className="z-50 items-end bg-black/70 sm:items-center">
      <div
        role="dialog"
        aria-labelledby="custom-tuning-title"
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#0F1422] p-5"
      >
        <SheetHeader
          titleId="custom-tuning-title"
          title={draft ? 'Edit custom tuning' : 'New custom tuning'}
          onClose={onClose}
          closeLabel="Close custom tuning"
          description={
            <p className="mt-1 text-sm text-pretty text-slate-400">
              Saved on this phone or computer only — no account needed.
            </p>
          }
        />

        <label className="mt-5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={32}
            className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-white outline-none focus:border-[#A855F7]"
          />
        </label>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Strings
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCount(count - 1)}
              disabled={count <= 4}
            >
              −
            </Button>
            <span className="w-8 text-center text-sm font-semibold text-white">
              {count}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCount(count + 1)}
              disabled={count >= 10}
            >
              +
            </Button>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {rows.map((row) => (
            <div
              key={row.index}
              className="grid grid-cols-[3.5rem_1fr_5.5rem] items-center gap-2 rounded-xl bg-white/4 px-3 py-2"
            >
              <span className="text-xs font-semibold text-slate-400">
                {row.stringNo}
                {ordinal(row.stringNo)}
              </span>
              <select
                value={row.pitchClass}
                onChange={(event) =>
                  setRow(row.index, Number(event.target.value), row.octave)
                }
                className="h-10 rounded-lg border border-white/10 bg-[#0B0F1A] px-2 text-sm text-white"
              >
                {SHARP_NAMES.map((note, pitchClass) => (
                  <option key={note} value={pitchClass}>
                    {note}
                  </option>
                ))}
              </select>
              <select
                value={row.octave}
                onChange={(event) =>
                  setRow(row.index, row.pitchClass, Number(event.target.value))
                }
                className="h-10 rounded-lg border border-white/10 bg-[#0B0F1A] px-2 text-sm text-white"
              >
                {OCTAVES.map((octave) => (
                  <option key={octave} value={octave}>
                    {octave}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {error ? <p className="mt-3 text-sm text-orange-300">{error}</p> : null}

        <div className="mt-5 flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button type="button" className="flex-1" onClick={save}>
            Save
          </Button>
        </div>
      </div>
    </OverlayHost>
  )
}

function ordinal(value: number): string {
  if (value === 1) return 'st'
  if (value === 2) return 'nd'
  if (value === 3) return 'rd'
  return 'th'
}
