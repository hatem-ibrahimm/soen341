import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCurrentUser } from '../../context/CurrentUserContext.jsx'
import { clearSession } from '../../services/session.js'
import Avatar from '../common/Avatar.jsx'
import styles from './ProfileMenu.module.css'

// The profile "bubble" in the top-right corner with a dropdown menu.
export default function ProfileMenu() {
    const { user, setUser } = useCurrentUser()
    const [open, setOpen] = useState(false)
    const ref = useRef(null)
    const navigate = useNavigate()

    useEffect(() => {
        const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
        document.addEventListener('mousedown', close)
        return () => document.removeEventListener('mousedown', close)
    }, [])

    function logOut() {
        clearSession()
        setUser(null)
        navigate('/login', { replace: true })
    }

    const first = user?.first_name ?? ''
    const last = user?.last_name ?? ''
    const close = () => setOpen(false)

    return (
        <div className={styles.wrap} ref={ref}>
            <button
                className={`${styles.bubble} ${open ? styles.bubbleOpen : ''}`}
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="Open profile menu"
            >
                <Avatar firstName={first} lastName={last} src={user?.avatar_url} size={38} />
            </button>

            {open && (
                <div className={styles.menu} role="menu">
                    <div className={styles.who}>
                        <strong>{first} {last}</strong>
                        <span>{user?.email}</span>
                    </div>
                    <Link to="/profile" role="menuitem" onClick={close}>My profile</Link>
                    <Link to="/applications" role="menuitem" onClick={close}>My applications</Link>
                    <Link to="/jobs" role="menuitem" onClick={close}>Browse jobs</Link>
                    <hr />
                    <button role="menuitem" className={styles.logout} onClick={logOut}>Log out</button>
                </div>
            )}
        </div>
    )
}
