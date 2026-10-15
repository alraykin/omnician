import { BrowserRouter, Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom'

import { AudioDebugOverlay } from '@/components/AudioDebugOverlay'
import { PhonePortraitGuard } from '@/components/PhonePortraitGuard'
import { ComingSoonPage } from '@/pages/ComingSoonPage'
import { AudioLabPage } from '@/pages/AudioLabPage'
import { HomePage } from '@/pages/HomePage'
import { FactoryPage } from '@/pages/FactoryPage'
import { LegalPage } from '@/pages/LegalPage'
import { RhythmPage } from '@/pages/RhythmPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { SilentLabPage } from '@/pages/SilentLabPage'
import { TunerPage } from '@/pages/TunerPage'
import { legacyRhythmLocation } from '@/lib/tool-routes'
import type { RhythmMode } from '@/lib/rhythm'

function AudioDebugGate() {
  const [params] = useSearchParams()
  const { pathname } = useLocation()
  if (pathname === '/audio-lab' || pathname === '/lab/silent') return null
  if (params.get('debug') !== 'audio') return null
  return <AudioDebugOverlay />
}

function LegacyRhythmRedirect({ force }: { force?: RhythmMode }) {
  const [params] = useSearchParams()
  return <Navigate to={legacyRhythmLocation(params.toString(), force)} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AudioDebugGate />
      <PhonePortraitGuard />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tuner" element={<TunerPage />} />
        <Route path="/tuner/*" element={<TunerPage />} />
        <Route element={<RhythmPage />}>
          <Route path="/click" element={null} />
          <Route path="/drums" element={null} />
        </Route>
        <Route path="/rhythm" element={<LegacyRhythmRedirect />} />
        <Route path="/rhythm/*" element={<LegacyRhythmRedirect />} />
        <Route path="/metronome" element={<LegacyRhythmRedirect force="click" />} />
        <Route path="/drum-machine" element={<LegacyRhythmRedirect force="drums" />} />
        <Route path="/audio-lab" element={<AudioLabPage />} />
        <Route path="/lab/silent" element={<SilentLabPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/:category" element={<SettingsPage />} />
        <Route path="/factory" element={<FactoryPage />} />
        <Route path="/privacy" element={<LegalPage id="privacy" />} />
        <Route path="/terms" element={<LegalPage id="terms" />} />
        <Route path="/credits" element={<LegalPage id="credits" />} />
        <Route path="/support" element={<LegalPage id="support" />} />
        <Route path="/:slug" element={<ComingSoonPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
