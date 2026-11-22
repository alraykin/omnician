const MAX_EVENTS = 10

let events: string[] = []

function stamp(): string {
  const d = new Date()
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

/** Last 10 AudioContext / AVAudioSession events for the 5-tap overlay. */
export function noteAudioEvent(msg: string): void {
  events.push(`${stamp()} ${msg}`)
  if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS)
}

export function audioEventLog(): string[] {
  return events.slice()
}

export function audioEventLine(): string {
  return events.length ? events.join(' · ') : '—'
}

export function resetAudioEventsForTests(): void {
  events = []
}
