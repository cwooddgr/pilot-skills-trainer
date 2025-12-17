import { BrowserRouter as Router } from 'react-router-dom'
import { AppRoutes } from './components/AppRoutes'
import { Navigation } from './components/Navigation'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-900 text-slate-100">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <AppRoutes />
        </main>
      </div>
    </Router>
  )
}

export default App
