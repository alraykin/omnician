import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  MIDI_NOTE_OPTIONS,
  assignMidiNote,
  cloneMidiMap,
  DEFAULT_MIDI_MAP,
  midiMapRows,
  type MidiNoteMap,
} from '@/lib/midi-map'
import { listenForMidiNote, webMidiSupported } from '@/lib/midi-web'
import type { VoiceId } from '@/lib/rhythm'

export function MidiMapEditor({
  map,
  onChange,
}: {
  map: MidiNoteMap
  onChange: (next: MidiNoteMap) => void
}) {
  const [learning, setLearning] = useState<VoiceId | null>(null)
  const [learnError, setLearnError] = useState<string | null>(null)
  const canLearn = webMidiSupported()

  useEffect(() => {
    if (!learning) return
    let active = true
    let listener: { stop: () => void } | null = null
    void listenForMidiNote((note) => {
      if (!active) return
      onChange(assignMidiNote(map, learning, note))
      setLearning(null)
    })
      .then((next) => {
        if (!active) {
          next.stop()
          return
        }
        listener = next
      })
      .catch(() => {
        if (!active) return
        setLearnError('Could not open MIDI input.')
        setLearning(null)
      })
    return () => {
      active = false
      listener?.stop()
    }
  }, [learning, map, onChange])

  return (
    <div data-midi-map-editor>
      <p className="text-sm leading-5 text-slate-400">
        Middle C is <span className="text-slate-200">C3</span> (MIDI 60). Change a drum’s note if
        your file uses a different map.
      </p>
      <ul className="mt-3 space-y-1">
        {midiMapRows(map).map((row) => (
          <li
            key={row.voice}
            data-midi-map-row={row.voice}
            className="flex items-center gap-2 rounded-xl border border-white/8 bg-[#141A28]/80 px-2.5 py-1.5"
          >
            <span className="min-w-0 flex-1 text-sm font-semibold text-white">{row.label}</span>
            <label className="sr-only" htmlFor={`midi-note-${row.voice}`}>
              MIDI note for {row.label}
            </label>
            <select
              id={`midi-note-${row.voice}`}
              data-midi-note={row.voice}
              value={row.note}
              onChange={(event) => onChange(assignMidiNote(map, row.voice, Number(event.target.value)))}
              className="h-9 max-w-[7.5rem] rounded-lg border border-white/12 bg-[#141A28] px-2 text-sm font-semibold text-white"
            >
              {MIDI_NOTE_OPTIONS.map((option) => (
                <option key={option.note} value={option.note}>
                  {option.name}
                </option>
              ))}
            </select>
            <span className="w-8 text-right text-[0.7rem] tabular-nums text-slate-500" data-midi-number={row.voice}>
              {row.note}
            </span>
            {canLearn ? (
              <Button
                type="button"
                size="sm"
                variant={learning === row.voice ? 'default' : 'outline'}
                data-midi-learn={row.voice}
                className="h-9 shrink-0 px-2 text-xs"
                onClick={() => {
                  setLearnError(null)
                  setLearning((current) => (current === row.voice ? null : row.voice))
                }}
              >
                {learning === row.voice ? 'Listening…' : 'Learn'}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {learnError ? (
        <p className="mt-2 text-xs text-rose-300" data-midi-learn-error>
          {learnError}
        </p>
      ) : null}
      {!canLearn ? (
        <p className="mt-2 text-xs leading-4 text-slate-500">
          Learn from a MIDI keyboard is not available on this device.
        </p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="mt-4 w-full"
        data-midi-map-reset
        onClick={() => {
          setLearning(null)
          onChange(cloneMidiMap(DEFAULT_MIDI_MAP))
        }}
      >
        Reset to default
      </Button>
    </div>
  )
}

export function MidiMapSheet({
  map,
  onChange,
  onClose,
}: {
  map: MidiNoteMap
  onChange: (next: MidiNoteMap) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div
        role="dialog"
        aria-labelledby="midi-map-title"
        data-midi-map-sheet
        className="flex max-h-[90svh] w-full max-w-lg flex-col overflow-y-auto rounded-3xl border border-white/10 bg-[#0F1422] p-5"
      >
        <h2 id="midi-map-title" className="text-xl font-bold tracking-tight text-white">
          MIDI import mapping
        </h2>
        <div className="mt-2">
          <MidiMapEditor map={map} onChange={onChange} />
        </div>
        <Button type="button" className="mt-4 w-full" data-midi-map-done onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  )
}
