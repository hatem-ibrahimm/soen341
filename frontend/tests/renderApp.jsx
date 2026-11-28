import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../src/App.jsx'
import { CurrentUserProvider } from '../src/context/CurrentUserContext.jsx'
import { ensureDemoSession } from '../src/services/mockStore.js'
import { saveSession } from '../src/services/session.js'

// Opens the whole app at `path`, logged in as the demo user, exactly like
// `npm run dev:mock` does in a real browser (see src/main.jsx).
export function renderApp(path = '/', { loggedIn = true, role } = {}) {
    if (loggedIn) {
        ensureDemoSession()
        if (role) {
            saveSession(
                'mock-token',
                '00000000-0000-4000-8000-000000000001',
                role,
                role === 'recruiter' ? 'Northwind Labs' : '',
            )
        }
    }
    const user = userEvent.setup()
    const view = render(
        <MemoryRouter initialEntries={[path]}>
            <CurrentUserProvider>
                <App />
            </CurrentUserProvider>
        </MemoryRouter>,
    )
    return { user, ...view }
}
