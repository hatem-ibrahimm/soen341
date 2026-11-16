import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../src/App.jsx'
import { CurrentUserProvider } from '../src/context/CurrentUserContext.jsx'
import { ensureDemoSession } from '../src/services/mockStore.js'

// Opens the whole app at `path`, logged in as the demo user, exactly like
// `npm run dev:mock` does in a real browser (see src/main.jsx).
export function renderApp(path = '/', { loggedIn = true } = {}) {
    if (loggedIn) ensureDemoSession()
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
