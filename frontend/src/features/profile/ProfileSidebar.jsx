import { Link } from 'react-router-dom'
import styles from './ProfilePage.module.css'

const SECTIONS = [
    { id: 'about', label: 'About' },
    { id: 'experience', label: 'Experience' },
    { id: 'education', label: 'Education' },
    { id: 'skills', label: 'Skills' },
     { id: 'resumes', label: 'Resumes' },
]

// Right column. It stays in place while the left column scrolls (position: sticky in the CSS).
export default function ProfileSidebar() {
    return (
        <aside className={styles.sidebar}>
            <nav className={styles.sideBox} aria-label="Profile sections">
                <p className={styles.sideTitle}>On this page</p>
                {SECTIONS.map((s) => (
                    <a key={s.id} href={`#${s.id}`} className={styles.sideLink} onClick={(e) => {
                        e.preventDefault()
                        document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' })
                    }}>
                        {s.label}
                    </a>
                ))}
            </nav>
            <div className={styles.sideBox}>
                <p className={styles.sideTitle}>Job search</p>
                <Link className={styles.sideLink} to="/applications">Track my applications</Link>
                <Link className={styles.sideLink} to="/jobs">Browse jobs</Link>
            </div>
        </aside>
    )
}
