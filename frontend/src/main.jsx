import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { CurrentUserProvider } from './context/CurrentUserContext.jsx'
import { USE_MOCK_API } from './services/apiClient.js'
import { ensureDemoSession } from './services/mockStore.js'
import './styles/theme.css'

// Sample-data mode (npm run dev:mock) logs in a demo user automatically.
if (USE_MOCK_API) ensureDemoSession()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <CurrentUserProvider>
        <App />
      </CurrentUserProvider>
    </BrowserRouter>
  </StrictMode>,
)