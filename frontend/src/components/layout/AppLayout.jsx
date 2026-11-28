import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import DemoBar from './DemoBar.jsx'
import ProfileMenu from './ProfileMenu.jsx'
import styles from './AppLayout.module.css'
import { getUnreadNotificationCount } from '../../services/notificationsApi.js'
import { getUserRole } from '../../services/session.js'

// Top bar + page container shared by every logged-in page.
export default function AppLayout() {
    const [unreadCount, setUnreadCount] = useState(null)
    const [unreadError, setUnreadError] = useState(false)
    const location = useLocation()
    const role = getUserRole()
    const isRecruiter = role === 'recruiter'
    const refreshUnreadCount = useCallback(() => {
        getUnreadNotificationCount()
            .then((count) => {
                setUnreadCount(count)
                setUnreadError(false)
            })
            .catch(() => {
                setUnreadCount(null)
                setUnreadError(true)
            })
    }, [])

    useEffect(() => {
        refreshUnreadCount()
        const interval = window.setInterval(refreshUnreadCount, 30_000)
        window.addEventListener('notifications:updated', refreshUnreadCount)
        return () => {
            window.clearInterval(interval)
            window.removeEventListener('notifications:updated', refreshUnreadCount)
        }
    }, [refreshUnreadCount, location.pathname])

    const navClass = ({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`
    return (
        <div className={styles.shell}>
            <header className={styles.topbar}>
                <div className={styles.inner}>
                    <Link to={isRecruiter ? '/recruiter' : '/jobs'} className={styles.brand}>
                        CareerConnect
                    </Link>
                    <nav className={styles.nav} aria-label="Main">
                        <NavLink to="/jobs" className={navClass}>
                            Jobs Listings
                        </NavLink>
                        <NavLink to="/applications" className={navClass}>
                            My Applications
                        </NavLink>
                        <NavLink to="/dashboard" className={navClass}>
                            Job Dashboard
                        </NavLink>
                        <NavLink
                            to="/notifications"
                            className={navClass}
                            aria-label={unreadError ? 'Notifications; unread count unavailable' : 'Notifications'}
                        >
                            Notifications
                            {unreadCount > 0 && (
                                <span className={styles.notificationCount} aria-label={`${unreadCount} unread`}>
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            )}
                            {unreadError && (
                                <span className={styles.notificationError} title="Unable to load unread notification count">
                                    !
                                </span>
                            )}
                        </NavLink>
                        {isRecruiter && (
                            <NavLink to="/recruiter" className={navClass}>
                                Recruiter Workspace
                            </NavLink>
                        )}
                    </nav>
                    <ProfileMenu />
                </div>
            </header>
            <main className={styles.main}>
                <Outlet />
            </main>
            <DemoBar />
        </div>
    )
}
