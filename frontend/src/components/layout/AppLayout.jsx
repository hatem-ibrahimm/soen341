import { Link, NavLink, Outlet } from 'react-router-dom'
import DemoBar from './DemoBar.jsx'
import ProfileMenu from './ProfileMenu.jsx'
import styles from './AppLayout.module.css'

// Top bar + page container shared by every logged-in page.
export default function AppLayout() {
    const navClass = ({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`
    return (
        <div className={styles.shell}>
            <header className={styles.topbar}>
                <div className={styles.inner}>
                    <Link to="/jobs" className={styles.brand}>
                        CarrerConnect
                    </Link>
                    <nav className={styles.nav} aria-label="Main">
                        <NavLink to="/jobs" className={navClass}>
                            Jobs
                        </NavLink>
                        <NavLink to="/applications" className={navClass}>
                            My applications
                        </NavLink>
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
