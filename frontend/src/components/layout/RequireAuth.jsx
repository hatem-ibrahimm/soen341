import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { isLoggedIn } from '../../services/session.js'

// Wrap routes that need a logged-in user.
export default function RequireAuth() {
    const location = useLocation()
    if (!isLoggedIn()) {
        return (
            <Navigate
                to="/login"
                replace
                state={{ message: 'Please log in to continue.', from: location.pathname }}
            />
        )
    }
    return <Outlet />
}
