import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { ComingSoonPage } from '@/pages/ComingSoonPage'
import { HomePage } from '@/pages/HomePage'
import { TunerPage } from '@/pages/TunerPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tuner" element={<TunerPage />} />
        <Route path="/:slug" element={<ComingSoonPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
