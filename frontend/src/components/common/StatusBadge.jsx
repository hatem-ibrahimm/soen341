import { STATUS_TONE } from '../../constants/applicationStatus.js'
import styles from './StatusBadge.module.css'

export default function StatusBadge({ status }) {
    const tone = STATUS_TONE[status] ?? 'blue'
    return <span className={`${styles.badge} ${styles[tone]}`}>{status}</span>
}
