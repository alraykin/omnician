import { useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

import { FoldModePicker } from '@/components/fold/FoldModePicker'
import { SettingsChrome, SettingRow, SettingSwitch, settingsBackFrom } from '@/components/SettingsChrome'
import { MidiMapEditor } from '@/components/rhythm/MidiMapSheet'
import { InputPicker } from '@/components/tuner/InputPicker'
import { APP_COPYRIGHT, APP_NAME, APP_VERSION } from '@/lib/app-info'
import { layoutModeLabel, loadTunerPrefs, patchTunerPrefs, type TunerLayoutMode } from '@/lib/custom-presets'
import { loadMidiMap, saveMidiMap, type MidiNoteMap } from '@/lib/midi-map'
import { ClickSoundPicker } from '@/components/rhythm/ClickSoundPicker'
import { type ClickSoundId } from '@/lib/rhythm'
import { loadRhythmPrefs, patchRhythmPrefs } from '@/lib/rhythm-prefs'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  { id: 'tuner', title: 'Tuner', blurb: 'Auto strings, headstock view, input' },
  { id: 'click', title: 'Click', blurb: 'Click sound' },
  { id: 'drums', title: 'Drums', blurb: 'MIDI import mapping' },
  { id: 'speed-builder', title: 'Speed Builder', blurb: 'Announce and precount' },
  { id: 'audio', title: 'Sound & Audio', blurb: 'What stays on the tool pages' },
  { id: 'about', title: 'About & Legal', blurb: 'Privacy, terms, credits, support' },
] as const

type CategoryId = (typeof CATEGORIES)[number]['id']

function isCategory(value: string | undefined): value is CategoryId {
  return CATEGORIES.some((item) => item.id === value)
}

export function SettingsPage() {
  const { category } = useParams()
  const location = useLocation()
  const from = settingsBackFrom((location.state as { from?: string } | null)?.from)
  const current = isCategory(category) ? category : null
  const title = current ? CATEGORIES.find((item) => item.id === current)?.title ?? 'Settings' : 'Settings'

  return (
    <SettingsChrome
      title={title}
      backTo={current ? '/settings' : from}
      backLabel={current ? 'Settings' : 'Back'}
      backState={{ from }}
    >
      {current ? <CategoryPanel id={current} /> : <CategoryList from={from} />}
    </SettingsChrome>
  )
}

function CategoryList({ from }: { from: string }) {
  return (
    <nav aria-label="Settings" className="space-y-2" data-settings-home>
      {CATEGORIES.map((item) => (
        <Link
          key={item.id}
          to={`/settings/${item.id}`}
          state={{ from }}
          data-settings-cat={item.id}
          className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#141A28]/80 px-4 py-3.5"
        >
          <span>
            <span className="block text-base font-semibold text-white">{item.title}</span>
            <span className="mt-0.5 block text-xs text-slate-500">{item.blurb}</span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-slate-500" />
        </Link>
      ))}
    </nav>
  )
}

function CategoryPanel({ id }: { id: CategoryId }) {
  if (id === 'tuner') return <TunerSettings />
  if (id === 'click') return <ClickSettings />
  if (id === 'drums') return <DrumsSettings />
  if (id === 'speed-builder') return <SpeedBuilderSettings />
  if (id === 'audio') return <AudioSettings />
  return <AboutSettings />
}

function FoldModeSetting() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#141A28]/80 px-3 py-3" data-fold-settings>
      <p className="text-sm font-semibold text-white">Fold mode</p>
      <p className="mt-0.5 text-xs leading-4 text-slate-500">
        iPhone Duo inner display. Off is today&apos;s layout. Auto uses the hinge when the browser
        reports it. Tent is always chosen here.
      </p>
      <div className="mt-2">
        <FoldModePicker />
      </div>
    </div>
  )
}

function TunerSettings() {
  const [prefs, setPrefs] = useState(() => loadTunerPrefs())
  const setAuto = (autoString: boolean) => setPrefs(patchTunerPrefs({ autoString }))
  const setLayout = (layoutMode: TunerLayoutMode) => setPrefs(patchTunerPrefs({ layoutMode }))

  return (
    <div className="space-y-3" data-settings-panel="tuner">
      <FoldModeSetting />
      <SettingRow label="Auto strings" hint="Follow the nearest string while you play.">
        <SettingSwitch label="Auto strings" on={prefs.autoString} onChange={setAuto} />
      </SettingRow>
      <SettingRow label="Headstock view" hint="Default for 4–10 string instruments. 12-string always uses Split.">
        <div className="flex rounded-full border border-white/12 p-0.5">
          {(['headstock', 'inline'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              data-layout-mode={mode}
              aria-pressed={prefs.layoutMode === mode}
              onClick={() => setLayout(mode)}
              className={cn(
                'h-8 rounded-full px-3 text-xs font-semibold',
                prefs.layoutMode === mode ? 'bg-[#A855F7] text-white' : 'text-slate-300',
              )}
            >
              {layoutModeLabel(mode)}
            </button>
          ))}
        </div>
      </SettingRow>
      <div className="rounded-2xl border border-white/10 bg-[#141A28]/80 px-3 py-3">
        <p className="text-sm font-semibold text-white">Microphone input</p>
        <p className="mt-0.5 text-xs leading-4 text-slate-500">
          Shown when this device has more than one input.
        </p>
        <InputPicker alwaysShow className="mt-2" />
      </div>
    </div>
  )
}

function ClickSettings() {
  const [sound, setSound] = useState<ClickSoundId>(() => loadRhythmPrefs().clickSound)

  return (
    <div className="space-y-3" data-settings-panel="click">
      <FoldModeSetting />
      <p className="text-sm leading-5 text-slate-400">
        Wood, Clave, Digital, or Mechanical. Same picker as on the Click page — the sound Play uses
        on Click, and the guide click while you record.
      </p>
      <ClickSoundPicker
        value={sound}
        onChange={(id) => {
          setSound(id)
          patchRhythmPrefs({ clickSound: id })
        }}
      />
    </div>
  )
}

function DrumsSettings() {
  const [map, setMap] = useState<MidiNoteMap>(() => loadMidiMap())
  const onChange = (next: MidiNoteMap) => {
    setMap(next)
    saveMidiMap(next)
  }

  return (
    <div data-settings-panel="drums">
      <FoldModeSetting />
      <h2 className="mt-3 text-base font-semibold text-white">MIDI import mapping</h2>
      <div className="mt-3">
        <MidiMapEditor map={map} onChange={onChange} />
      </div>
    </div>
  )
}

function SpeedBuilderSettings() {
  const initial = useMemo(() => loadRhythmPrefs().speedBuilder, [])
  const [announce, setAnnounce] = useState(initial.announce)
  const [precount, setPrecount] = useState(initial.precount)

  const patch = (next: { announce?: boolean; precount?: boolean }) => {
    const prefs = loadRhythmPrefs()
    const speedBuilder = { ...prefs.speedBuilder, ...next }
    patchRhythmPrefs({ speedBuilder })
    if (next.announce != null) setAnnounce(next.announce)
    if (next.precount != null) setPrecount(next.precount)
  }

  return (
    <div className="space-y-3" data-settings-panel="speed-builder">
      <p className="text-sm leading-5 text-slate-400">
        From / To / Step / Repeats stay on the Click and Drums tempo card. Announce and Precount
        are on that same panel; these switches are a duplicate.
      </p>
      <SettingRow label="Announce" hint="Speak the new percent when Speed Builder steps.">
        <SettingSwitch label="Announce" on={announce} onChange={(value) => patch({ announce: value })} />
      </SettingRow>
      <SettingRow
        label="Precount"
        hint="One bar of count-in. On Drums this also runs when Speed Builder is off."
      >
        <SettingSwitch label="Precount" on={precount} onChange={(value) => patch({ precount: value })} />
      </SettingRow>
    </div>
  )
}

function AudioSettings() {
  return (
    <div className="space-y-3 text-sm leading-6 text-slate-400" data-settings-panel="audio">
      <p>
        <span className="font-semibold text-white">Volume</span> is the device volume. Click and
        Drums play as loud as they can without clipping; there is no in-app master fader.
      </p>
      <p>
        Kit mix and Intensity stay under the drum grid. Click sound lives on the Click page, with
        a copy here.
      </p>
    </div>
  )
}

function AboutSettings() {
  const location = useLocation()
  const from = settingsBackFrom((location.state as { from?: string } | null)?.from)
  return (
    <div className="space-y-2" data-settings-panel="about">
      <Link className="block rounded-2xl border border-white/10 bg-[#141A28]/80 px-4 py-3 text-sm font-semibold text-white" to="/privacy" state={{ from }}>
        Privacy Policy
      </Link>
      <Link className="block rounded-2xl border border-white/10 bg-[#141A28]/80 px-4 py-3 text-sm font-semibold text-white" to="/terms" state={{ from }}>
        Terms of Use
      </Link>
      <Link className="block rounded-2xl border border-white/10 bg-[#141A28]/80 px-4 py-3 text-sm font-semibold text-white" to="/credits" state={{ from }}>
        Credits &amp; Licenses
      </Link>
      <Link className="block rounded-2xl border border-white/10 bg-[#141A28]/80 px-4 py-3 text-sm font-semibold text-white" to="/support" state={{ from }}>
        Support / Contact
      </Link>
      <p className="pt-3 text-center text-xs text-slate-500">
        {APP_NAME} {APP_VERSION}
        <br />
        {APP_COPYRIGHT}
      </p>
    </div>
  )
}
