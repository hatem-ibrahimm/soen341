import styles from './Card.module.css'

// A white section card. Pass `title` + optional `actions` (e.g. an Edit button).
export default function Card({ title, actions, children, className = '', as: Tag = 'section', ...rest }) {
    return (
        <Tag className={`${styles.card} ${className}`} {...rest}>
            {(title || actions) && (
                <header className={styles.header}>
                    {title && <h2 className={styles.title}>{title}</h2>}
                    {actions && <div className={styles.actions}>{actions}</div>}
                </header>
            )}
            {children}
        </Tag>
    )
}
