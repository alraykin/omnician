import {
  HIGH_INTENSITY_GAIN,
  INTENSITY_STRENGTH,
  KIT_INTENSITIES,
  defaultIntensityForStyle,
  playOptsForRole,
  scaleLayer,
  type KitIntensity,
} from '../src/lib/kit-intensity.ts'
import { realizeDrumBar } from '../src/lib/kit-intensity-play.ts'
import { VOICES } from '../src/lib/rhythm.ts'
import { RHYTHM_STYLES, type RhythmStyleId } from '../src/lib/rhythm-presets.ts'
import { barsForPreset } from '../src/lib/rhythm-presets.ts'

function hitId(voice: string, hit: { beat: number; num: number; den: number }): string {
  return `${voice}:${hit.beat}:${hit.num}/${hit.den}`
}

function fingerprint(hits: ReturnType<typeof realizeDrumBar>['hits']): string {
  return hits
    .map((hit) => hitId(hit.voice, hit.hit))
    .sort()
    .join('|')
}

function main(): void {
  let failed = 0

  const highBackbeat = playOptsForRole('high', 'backbeat')
  if (highBackbeat.tier !== 5 || highBackbeat.blendMix !== 0) {
    failed += 1
    console.error(`HIGH layer drifted: ${JSON.stringify(highBackbeat)}`)
  }
  const expectedVel = 0.92 * HIGH_INTENSITY_GAIN
  if (Math.abs(highBackbeat.vel - expectedVel) > 1e-9) {
    failed += 1
    console.error(`HIGH vel drifted: ${highBackbeat.vel} vs ${expectedVel}`)
  }

  const mid = scaleLayer(5, INTENSITY_STRENGTH.mid)
  const low = scaleLayer(5, INTENSITY_STRENGTH.low)
  if (Math.abs(INTENSITY_STRENGTH.mid - 0.85) > 1e-9 || Math.abs(INTENSITY_STRENGTH.low - 0.72) > 1e-9) {
    failed += 1
    console.error('strength map must stay 1.0 / 0.85 / 0.72')
  }
  if (mid.tier < 4 || low.tier < 3) {
    failed += 1
    console.error(`Low/Mid jumped too soft: mid=${JSON.stringify(mid)} low=${JSON.stringify(low)}`)
  }

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
      console.error(`DEFAULT ${style}: expected ${level}`)
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
        console.error(`PATTERN ${style.id} ${row.level}: notes changed`)
      }
      if (row.realized.hits.some((hit) => hit.rimshot)) {
        failed += 1
        console.error(`RIMSHOT ${style.id} ${row.level}`)
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
    }
  }

  if (failed > 0) {
    console.error(`${failed} intensity check(s) failed`)
    process.exit(1)
  }
  console.log(
    `High stays t${highBackbeat.tier} vel ${highBackbeat.vel.toFixed(3)}; Mid blend t${mid.tier}/${mid.blendTier} @ ${mid.blendMix.toFixed(2)}; Low blend t${low.tier}/${low.blendTier} @ ${low.blendMix.toFixed(2)}`,
  )
  console.log(`${RHYTHM_STYLES.length} styles: same notes, High reference unchanged, strength 1.00 / 0.85 / 0.72`)
}

main()
