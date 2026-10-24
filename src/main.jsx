import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import ServerWakeNotice from './components/ServerWakeNotice.jsx'
import { wakeApi } from './api/apiClient.js'

// Apply the saved light/dark choice before the first paint, so the Login
// screen (shown before AppLayout's toggle exists) matches it too (T051).
try {
  const stored = localStorage.getItem('theme')
  const dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.classList.toggle('dark', dark)
} catch {
  // Storage blocked: fall back to light, as before.
}

// Start the API server now if it is asleep (Oct 23, cold start): by the time
// someone has signed in, it has usually finished starting.
wakeApi()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <ServerWakeNotice />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)