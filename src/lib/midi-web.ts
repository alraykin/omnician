/** Web MIDI is available on most desktops; iOS Safari does not implement it. */
export function webMidiSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function'
}

export type MidiNoteListener = {
  stop: () => void
}

export async function listenForMidiNote(
  onNote: (note: number) => void,
): Promise<MidiNoteListener> {
  if (!webMidiSupported()) {
    throw new Error('Web MIDI is not available on this device.')
  }
  const access = await navigator.requestMIDIAccess({ sysex: false })
  const handle = (event: Event) => {
    const message = event as MIDIMessageEvent
    const data = message.data
    if (!data || data.length < 3) return
    const status = data[0] ?? 0
    const note = data[1] ?? 0
    const velocity = data[2] ?? 0
    if ((status & 0xf0) === 0x90 && velocity > 0) onNote(note)
  }
  const inputs: MIDIInput[] = []
  access.inputs.forEach((input) => {
    input.addEventListener('midimessage', handle)
    inputs.push(input)
  })
  return {
    stop() {
      for (const input of inputs) input.removeEventListener('midimessage', handle)
    },
  }
}
