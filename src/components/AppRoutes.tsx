import { Routes, Route } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { HardwarePage } from './pages/HardwarePage'
import { TrainingPage } from './pages/TrainingPage'
import { AnalyticsPage } from './pages/AnalyticsPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/hardware" element={<HardwarePage />} />
      <Route path="/training" element={<TrainingPage />} />
      <Route path="/analytics" element={<AnalyticsPage />} />
    </Routes>
  )
}
