import {
  KIT_INTENSITIES,
  defaultIntensityForStyle,
  dynamicsFor,
  type KitIntensity,
} from '../src/lib/kit-intensity.ts'
import { estimateBarEnergy, quartersInBar, realizeDrumBar } from '../src/lib/kit-intensity-play.ts'
import { VOICES } from '../src/lib/rhythm.ts'
import { RHYTHM_STYLES, barsForPreset, type RhythmStyleId } from '../src/lib/rhythm-presets.ts'

function hitId(voice: string, hit: { beat: number; num: number; den: number }): string {
  return `${voice}:${hit.beat}:${hit.num}/${hit.den}`
}

function fingerprint(hits: ReturnType<typeof realizeDrumBar>['hits']): string {
  return hits
    .map((hit) => hitId(hit.voice, hit.hit))
    .sort()
    .join('|')
}

function meanVel(hits: ReturnType<typeof realizeDrumBar>['hits']): number {
  if (!hits.length) return 0
  return hits.reduce((sum, hit) => sum + hit.vel, 0) / hits.length
}

function ampFromEnergy(energy: number): number {
  return Math.sqrt(Math.max(0, energy))
}

function main(): void {
  let failed = 0
  const rows: Array<{
    style: RhythmStyleId
    groove: string
    level: KitIntensity
    hits: number
    energy: number
    vel: number
    gain: number
    accentTier: number
  }> = []

  const expectedDefault: Record<string, KitIntensity> = {
    rock: 'high',
    metal: 'high',
    odd: 'high',
    funk: 'mid',
    jazz: 'low',
    waltz: 'low',
  }
  for (const [style, level] of Object.entries(expectedDefault)) {
    if (defaultIntensityForStyle(style as RhythmStyleId) !== level) {
      failed += 1
      console.error(`DEFAULT ${style}: expected ${level}, got ${defaultIntensityForStyle(style as RhythmStyleId)}`)
    }
  }

  for (const style of RHYTHM_STYLES) {
    const groove = style.grooves[0]
    if (!groove) throw new Error(`No groove for ${style.id}`)
    const bar = barsForPreset(groove)[0]
    if (!bar) throw new Error(`No bar for ${groove.id}`)

    const byLevel = KIT_INTENSITIES.map((level) => {
      const realized = realizeDrumBar(bar, level)
      return { level, realized, print: fingerprint(realized.hits) }
    })

    const writtenKeys = VOICES.flatMap((voice) =>
      (bar.pattern[voice] ?? [])
        .filter((hit) => hit.beat >= 0 && hit.beat < bar.beats)
        .map((hit) => hitId(voice, hit)),
    )
      .sort()
      .join('|')

    for (const row of byLevel) {
      if (row.print !== writtenKeys) {
        failed += 1
        console.error(
          `PATTERN ${style.id} ${row.level}: realized hits differ from the written groove (${row.realized.hits.length} vs ${writtenKeys.split('|').filter(Boolean).length})`,
        )
      }
      if (row.realized.hits.some((hit) => hit.rimshot)) {
        failed += 1
        console.error(`RIMSHOT ${style.id} ${row.level}: intensity must not swap snare to rimshot`)
      }
    }

    for (let i = 1; i < byLevel.length; i += 1) {
      const prev = byLevel[i - 1]
      const next = byLevel[i]
      if (!prev || !next) continue
      if (prev.print !== next.print) {
        failed += 1
        console.error(`PATTERN ${style.id}: ${prev.level} vs ${next.level} changed notes`)
      }
      const prevTier = dynamicsFor(prev.level).accentTier
      const nextTier = dynamicsFor(next.level).accentTier
      if (!(nextTier > prevTier)) {
        failed += 1
        console.error(`TIER ${style.id}: ${next.level} is not a harder layer than ${prev.level}`)
      }
    }

    const amps = byLevel.map(
      (row) => ampFromEnergy(estimateBarEnergy(row.realized.hits) / quartersInBar(bar)),
    )
    const midAmp = amps[1] ?? 0
    for (let i = 0; i < byLevel.length; i += 1) {
      const row = byLevel[i]
      const amp = amps[i] ?? 0
      if (!row) continue
      const ratio = amp / Math.max(midAmp, 1e-9)
      if (ratio < 0.96 || ratio > 1.04) {
        failed += 1
        console.error(
          `LEVEL ${style.id}: ${row.level} volume ${ratio.toFixed(3)}× Mid (want matched, 0.96–1.04)`,
        )
      }
    }

    for (const row of byLevel) {
      rows.push({
        style: style.id,
        groove: groove.id,
        level: row.level,
        hits: row.realized.hits.length,
        energy: estimateBarEnergy(row.realized.hits) / quartersInBar(bar),
        vel: meanVel(row.realized.hits),
        gain: row.realized.gain,
        accentTier: row.realized.dynamics.accentTier,
      })
    }
  }

  const header = 'style'.padEnd(8) + 'lv    hits  t  gain   vel    energy'
  console.log(header)
  for (const row of rows) {
    console.log(
      `${row.style.padEnd(8)}${row.level.padEnd(6)}${String(row.hits).padStart(4)}  ${String(row.accentTier).padStart(1)}  ${row.gain.toFixed(2).padStart(4)}  ${row.vel.toFixed(3).padStart(5)}  ${row.energy.toFixed(4)}`,
    )
  }

  if (failed > 0) {
    console.error(`${failed} intensity check(s) failed`)
    process.exit(1)
  }
  console.log(`${rows.length} style×levels: same notes, harder layers, matched volume Low / Mid / High`)
}

main()
