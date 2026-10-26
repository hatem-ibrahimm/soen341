import styles from './Alert.module.css'

// tone: "error" | "success" | "info"
export default function Alert({ tone = 'info', children }) {
    return (
        <div className={`${styles.alert} ${styles[tone]}`} role={tone === 'error' ? 'alert' : 'status'}>
            {children}
        </div>
    )
}
