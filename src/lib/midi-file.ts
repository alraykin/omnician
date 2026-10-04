/** Minimal Standard MIDI File reader/writer. Type 0 and 1, no extra library. */

export type MidiTimeSig = {
  beats: number
  /** Denominator as a note value: 2, 4, 8, 16, or 32. */
  beatUnit: 2 | 4 | 8 | 16 | 32
}

export type MidiNoteOn = {
  tick: number
  note: number
  velocity: number
  channel: number
  track: number
}

export type ParsedMidi = {
  format: number
  ppq: number
  /** First tempo event, or null if the file has none. */
  tempoBpm: number | null
  /** First time-signature event, or null if the file has none. */
  timeSig: MidiTimeSig | null
  /** Last event tick (end of track or last note). */
  lastTick: number
  notes: MidiNoteOn[]
}

export class MidiParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MidiParseError'
  }
}

const DEFAULT_TEMPO_US = 500_000

export function usToBpm(usPerQuarter: number): number {
  if (!(usPerQuarter > 0)) return 120
  return 60_000_000 / usPerQuarter
}

export function bpmToUs(bpm: number): number {
  if (!(bpm > 0)) return DEFAULT_TEMPO_US
  return Math.round(60_000_000 / bpm)
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0
}

function readU16(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0)
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length))
}

function readVlq(bytes: Uint8Array, offset: number): { value: number; next: number } {
  let value = 0
  let cursor = offset
  for (let i = 0; i < 4; i += 1) {
    const byte = bytes[cursor]
    if (byte == null) throw new MidiParseError('MIDI file ended inside a time value.')
    cursor += 1
    value = (value << 7) | (byte & 0x7f)
    if ((byte & 0x80) === 0) return { value, next: cursor }
  }
  throw new MidiParseError('MIDI time value is too long.')
}

function writeVlq(value: number): number[] {
  const out: number[] = []
  let n = Math.max(0, value)
  const stack = [n & 0x7f]
  n >>= 7
  while (n > 0) {
    stack.push((n & 0x7f) | 0x80)
    n >>= 7
  }
  for (let i = stack.length - 1; i >= 0; i -= 1) out.push(stack[i] as number)
  return out
}

export function parseMidi(data: ArrayBuffer | Uint8Array): ParsedMidi {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  if (bytes.length < 14 || ascii(bytes, 0, 4) !== 'MThd') {
    throw new MidiParseError('This is not a MIDI file.')
  }
  const headerLen = readU32(bytes, 4)
  if (headerLen < 6) throw new MidiParseError('MIDI header is too short.')
  const format = readU16(bytes, 8)
  const trackCount = readU16(bytes, 10)
  const division = readU16(bytes, 12)
  if (division & 0x8000) {
    throw new MidiParseError('SMPTE MIDI files are not supported.')
  }
  const ppq = division || 96
  let cursor = 8 + headerLen
  const notes: MidiNoteOn[] = []
  let tempoBpm: number | null = null
  let timeSig: MidiTimeSig | null = null
  let lastTick = 0

  for (let track = 0; track < trackCount; track += 1) {
    if (cursor + 8 > bytes.length || ascii(bytes, cursor, 4) !== 'MTrk') {
      throw new MidiParseError('MIDI track header is missing.')
    }
    const trackLen = readU32(bytes, cursor + 4)
    const trackStart = cursor + 8
    const trackEnd = trackStart + trackLen
    if (trackEnd > bytes.length) throw new MidiParseError('MIDI track is truncated.')
    cursor = trackStart
    let tick = 0
    let running = 0

    while (cursor < trackEnd) {
      const delta = readVlq(bytes, cursor)
      cursor = delta.next
      tick += delta.value
      if (tick > lastTick) lastTick = tick
      const first = bytes[cursor]
      if (first == null) throw new MidiParseError('MIDI file ended inside a track.')
      let status = first
      if (status < 0x80) {
        if (running < 0x80) throw new MidiParseError('MIDI running status is missing.')
        status = running
      } else {
        cursor += 1
        running = status
      }

      if (status === 0xff) {
        const type = bytes[cursor]
        if (type == null) throw new MidiParseError('MIDI meta event is truncated.')
        cursor += 1
        const len = readVlq(bytes, cursor)
        cursor = len.next
        const payload = bytes.subarray(cursor, cursor + len.value)
        cursor += len.value
        if (type === 0x51 && payload.length >= 3 && tempoBpm == null) {
          const us = (payload[0]! << 16) | (payload[1]! << 8) | payload[2]!
          tempoBpm = usToBpm(us)
        }
        if (type === 0x58 && payload.length >= 2 && timeSig == null) {
          const beats = payload[0] || 4
          const power = payload[1] ?? 2
          const denom = 2 ** power
          const beatUnit = denom === 2 || denom === 4 || denom === 8 || denom === 16 || denom === 32 ? denom : 4
          timeSig = { beats, beatUnit }
        }
        if (type === 0x2f) break
        continue
      }

      if (status === 0xf0 || status === 0xf7) {
        const len = readVlq(bytes, cursor)
        cursor = len.next + len.value
        running = 0
        continue
      }

      const command = status & 0xf0
      const channel = status & 0x0f
      const needsTwo = command !== 0xc0 && command !== 0xd0
      const data1 = bytes[cursor]
      if (data1 == null) throw new MidiParseError('MIDI event is truncated.')
      cursor += 1
      let data2 = 0
      if (needsTwo) {
        const second = bytes[cursor]
        if (second == null) throw new MidiParseError('MIDI event is truncated.')
        data2 = second
        cursor += 1
      }
      if (command === 0x90 && data2 > 0) {
        notes.push({ tick, note: data1, velocity: data2, channel, track })
      }
    }
    cursor = trackEnd
  }

  return { format, ppq, tempoBpm, timeSig, lastTick, notes }
}

export type MidiWriteNote = {
  tick: number
  note: number
  velocity?: number
  duration?: number
  channel?: number
}

export function encodeMidi(opts: {
  ppq?: number
  bpm?: number
  beats?: number
  beatUnit?: 2 | 4 | 8 | 16 | 32
  notes: readonly MidiWriteNote[]
}): Uint8Array {
  const ppq = opts.ppq ?? 480
  const events: { tick: number; bytes: number[] }[] = [
    { tick: 0, bytes: [0xff, 0x51, 0x03, ...usBytes(bpmToUs(opts.bpm ?? 120))] },
    {
      tick: 0,
      bytes: [0xff, 0x58, 0x04, opts.beats ?? 4, Math.round(Math.log2(opts.beatUnit ?? 4)), 24, 8],
    },
  ]
  for (const note of opts.notes) {
    const channel = note.channel ?? 9
    const velocity = Math.max(1, Math.min(127, note.velocity ?? 100))
    events.push({ tick: note.tick, bytes: [0x90 | channel, note.note & 0x7f, velocity] })
    events.push({
      tick: note.tick + Math.max(1, note.duration ?? Math.round(ppq / 4)),
      bytes: [0x80 | channel, note.note & 0x7f, 0],
    })
  }
  events.sort((a, b) => a.tick - b.tick)
  const lastTick = events.reduce((max, event) => Math.max(max, event.tick), 0)
  events.push({ tick: lastTick, bytes: [0xff, 0x2f, 0x00] })

  const body: number[] = []
  let prev = 0
  for (const event of events) {
    body.push(...writeVlq(event.tick - prev), ...event.bytes)
    prev = event.tick
  }

  const header = [
    0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (ppq >> 8) & 0xff, ppq & 0xff,
    0x4d, 0x54, 0x72, 0x6b,
    (body.length >> 24) & 0xff,
    (body.length >> 16) & 0xff,
    (body.length >> 8) & 0xff,
    body.length & 0xff,
  ]
  return Uint8Array.from([...header, ...body])
}

function usBytes(us: number): number[] {
  const n = Math.max(1, Math.min(0xffffff, Math.round(us)))
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}
