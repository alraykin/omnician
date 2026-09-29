import { BrowserRouter, Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom'

import { AudioDebugOverlay } from '@/components/AudioDebugOverlay'
import { ComingSoonPage } from '@/pages/ComingSoonPage'
import { AudioLabPage } from '@/pages/AudioLabPage'
import { HomePage } from '@/pages/HomePage'
import { RhythmPage } from '@/pages/RhythmPage'
import { TunerPage } from '@/pages/TunerPage'

function AudioDebugGate() {
  const [params] = useSearchParams()
  const { pathname } = useLocation()
  if (pathname === '/audio-lab') return null
  if (params.get('debug') !== 'audio') return null
  return <AudioDebugOverlay />
}

export default function App() {
  return (
    <BrowserRouter>
      <AudioDebugGate />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tuner" element={<TunerPage />} />
        <Route path="/tuner/*" element={<TunerPage />} />
        <Route path="/rhythm" element={<RhythmPage />} />
        <Route path="/rhythm/*" element={<RhythmPage />} />
        <Route path="/metronome" element={<Navigate to="/rhythm?mode=click" replace />} />
        <Route path="/drum-machine" element={<Navigate to="/rhythm?mode=drums" replace />} />
        <Route path="/audio-lab" element={<AudioLabPage />} />
        <Route path="/:slug" element={<ComingSoonPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
