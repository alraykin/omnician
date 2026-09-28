import { styleIntensityProfile } from '../src/lib/kit-intensity.ts'
import {
  brightnessLoudnessOffset,
  estimateBarEnergy,
  quartersInBar,
  realizeDrumBar,
  TARGET_ENERGY_PER_QUARTER,
} from '../src/lib/kit-intensity-play.ts'
import { RHYTHM_STYLES, barsForPreset, type RhythmStyleId } from '../src/lib/rhythm-presets.ts'

const LIMIT_DB = 1.6

function db(ratio: number): number {
  return 20 * Math.log10(Math.max(1e-9, ratio))
}

function main(): void {
  const rows: Array<{
    style: RhythmStyleId
    groove: string
    level: number
    name: string
    hits: number
    ghosts: number
    opens: number
    hats: number
    crashes: number
    toms: number
    gain: number
    db: number
  }> = []
  let failed = 0

  for (const style of RHYTHM_STYLES) {
    const profile = styleIntensityProfile(style.id)
    const groove = style.grooves[0]
    if (!groove) throw new Error(`No groove for ${style.id}`)
    const bar = barsForPreset(groove)[0]
    if (!bar) throw new Error(`No bar for ${groove.id}`)
    for (const level of profile.levels) {
      const realized = realizeDrumBar(bar, style.id, level)
      const energy = estimateBarEnergy(realized.hits) / quartersInBar(bar)
      const perceived = energy / brightnessLoudnessOffset(realized.character.brightnessDb) ** 2
      const matchedDb = db(Math.sqrt(perceived / TARGET_ENERGY_PER_QUARTER))
      const ghosts = realized.hits.filter((hit) => hit.role === 'ghost').length
      const opens = realized.hits.filter((hit) => hit.voice === 'openHat').length
      const hats = realized.hits.filter((hit) => hit.voice === 'closedHat' || hit.voice === 'openHat').length
      const crashes = realized.hits.filter(
        (hit) => hit.voice === 'crash' || hit.voice === 'china' || hit.voice === 'splash',
      ).length
      const toms = realized.hits.filter(
        (hit) => hit.voice === 'highTom' || hit.voice === 'midTom' || hit.voice === 'floorTom',
      ).length
      rows.push({
        style: style.id,
        groove: groove.id,
        level,
        name: realized.character.name,
        hits: realized.hits.length,
        ghosts,
        opens,
        hats,
        crashes,
        toms,
        gain: realized.gain,
        db: matchedDb,
      })
      if (Math.abs(matchedDb) > LIMIT_DB) {
        failed += 1
        console.error(
          `LOUDNESS ${style.id} ${level} ${realized.character.name}: ${matchedDb.toFixed(2)} dB (gain ${realized.gain.toFixed(2)})`,
        )
      }
    }

    const first = rows.filter((row) => row.style === style.id)
    const low = first[0]
    const high = first[first.length - 1]
    if (low && high && high.hits <= low.hits && high.hats <= low.hats && high.ghosts <= low.ghosts) {
      console.warn(`CHARACTER ${style.id}: max is not busier than min (hits ${low.hits} → ${high.hits})`)
    }
  }

  const header = 'style'.padEnd(8) + 'lv  name          hits ghst hat  opn cym  gain   dB'
  console.log(header)
  for (const row of rows) {
    console.log(
      `${row.style.padEnd(8)}${String(row.level).padEnd(4)}${row.name.padEnd(14)}${String(row.hits).padStart(4)} ${String(row.ghosts).padStart(4)} ${String(row.hats).padStart(4)} ${String(row.opens).padStart(3)} ${String(row.crashes).padStart(3)}  ${row.gain.toFixed(2).padStart(5)} ${row.db.toFixed(2).padStart(6)}`,
    )
  }

  const dbs = rows.map((row) => row.db)
  const min = Math.min(...dbs)
  const max = Math.max(...dbs)
  console.log(`\nLoudness spread: ${min.toFixed(2)} … ${max.toFixed(2)} dB  (limit ±${LIMIT_DB})`)
  if (failed > 0) {
    console.error(`${failed} style×level(s) outside ±${LIMIT_DB} dB`)
    process.exit(1)
  }
  console.log(`${rows.length} style×levels loudness-matched`)
}

main()
