import { Navigate, Outlet } from 'react-router-dom'
import { getUserRole } from '../../services/session.js'

export default function RequireRole({ role, redirectTo, children }) {
    if (getUserRole() !== role) {
        return <Navigate to={redirectTo} replace />
    }
    return children ?? <Outlet />
}
