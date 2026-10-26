import { useEffect } from 'react'
import styles from './Modal.module.css'

// Simple dialog. Closes on Escape or backdrop click.
export default function Modal({ title, onClose, children, footer, width = 620 }) {
    useEffect(() => {
        const onKey = (e) => e.key === 'Escape' && onClose()
        document.addEventListener('keydown', onKey)
        document.body.style.overflow = 'hidden'
        return () => {
            document.removeEventListener('keydown', onKey)
            document.body.style.overflow = ''
        }
    }, [onClose])

    return (
        <div className={styles.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={title} style={{ maxWidth: width }}>
                <header className={styles.header}>
                    <h2>{title}</h2>
                    <button className={styles.close} onClick={onClose} aria-label="Close">
                        ×
                    </button>
                </header>
                <div className={styles.body}>{children}</div>
                {footer && <footer className={styles.footer}>{footer}</footer>}
            </div>
        </div>
    )
}
