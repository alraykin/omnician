let lastPlayedAt = 0
const COOLDOWN_MS = 1400

export function playInTuneChime(): void {
  const now = performance.now()
  if (now - lastPlayedAt < COOLDOWN_MS) return
  lastPlayedAt = now

  const AudioContextCtor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!AudioContextCtor) return

  const audio = new AudioContextCtor()
  const master = audio.createGain()
  master.gain.value = 0.0001
  master.connect(audio.destination)

  const start = audio.currentTime + 0.02
  const freqs = [659.25, 830.61, 987.77]

  freqs.forEach((frequency, index) => {
    const oscillator = audio.createOscillator()
    const voice = audio.createGain()
    oscillator.type = index === 0 ? 'sine' : 'triangle'
    oscillator.frequency.value = frequency
    voice.gain.value = index === 0 ? 0.22 : 0.09
    oscillator.connect(voice)
    voice.connect(master)
    oscillator.start(start)
    oscillator.stop(start + 0.55)
  })

  master.gain.setValueAtTime(0.0001, start)
  master.gain.exponentialRampToValueAtTime(0.16, start + 0.03)
  master.gain.exponentialRampToValueAtTime(0.04, start + 0.18)
  master.gain.exponentialRampToValueAtTime(0.0001, start + 0.55)

  window.setTimeout(() => {
    void audio.close()
  }, 800)
}
