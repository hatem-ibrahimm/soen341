import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getFullProfile } from '../services/profileApi.js'
import { isLoggedIn } from '../services/session.js'

// Shares the logged-in user's basic profile (name, photo) with the top-bar bubble
// and any page that needs it, so it is loaded once instead of on every page.
const CurrentUserContext = createContext(null)

export function CurrentUserProvider({ children }) {
    const [user, setUser] = useState(null)
    const location = useLocation()

    const refresh = useCallback(async () => {
        try {
            const { profile } = await getFullProfile()
            setUser(profile)
        } catch {
            setUser(null)
        }
    }, [])

    // Load the user after login (checked on every page change, so the login page
    // itself does not need to know about this).
    const loggedIn = isLoggedIn()
    useEffect(() => {
        if (loggedIn && !user) refresh()
    }, [loggedIn, user, refresh, location.pathname])

    return (
        <CurrentUserContext.Provider value={{ user, setUser, refresh }}>
            {children}
        </CurrentUserContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCurrentUser() {
    return useContext(CurrentUserContext)
}
