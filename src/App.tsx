import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { ComingSoonPage } from '@/pages/ComingSoonPage'
import { HomePage } from '@/pages/HomePage'
import { RhythmPage } from '@/pages/RhythmPage'
import { TunerPage } from '@/pages/TunerPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tuner" element={<TunerPage />} />
        <Route path="/rhythm" element={<RhythmPage />} />
        <Route path="/metronome" element={<Navigate to="/rhythm?mode=click" replace />} />
        <Route path="/drum-machine" element={<Navigate to="/rhythm?mode=drums" replace />} />
        <Route path="/:slug" element={<ComingSoonPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
