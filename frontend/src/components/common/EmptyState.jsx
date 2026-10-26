import styles from './EmptyState.module.css'

export default function EmptyState({ icon = '◇', title, children, action }) {
    return (
        <div className={styles.empty}>
            <div className={styles.icon} aria-hidden="true">{icon}</div>
            <p className={styles.title}>{title}</p>
            {children && <p className={styles.text}>{children}</p>}
            {action}
        </div>
    )
}
