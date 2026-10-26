import { PIPELINE_STEPS } from '../../constants/applicationStatus.js'
import { formatDate } from '../../services/format.js'
import styles from './StatusTracker.module.css'

// Horizontal progress tracker: Applied → Under Review → Interview → Offered.
// If rejected, it shows the steps that were reached, then a red "Rejected" step.
export default function StatusTracker({ status, history = [] }) {
    const dateFor = (s) => history.find((h) => h.status === s)?.changed_at

    let steps
    if (status === 'Rejected') {
        const reached = PIPELINE_STEPS.filter((s) => history.some((h) => h.status === s))
        steps = [
            ...reached.map((s) => ({ label: s, state: 'done' })),
            { label: 'Rejected', state: 'rejected' },
        ]
    } else {
        const current = PIPELINE_STEPS.indexOf(status)
        steps = PIPELINE_STEPS.map((s, i) => ({
            label: s,
            state: i < current ? 'done' : i === current ? (s === 'Offered' ? 'offered' : 'current') : 'todo',
        }))
    }

    return (
        <ol className={styles.tracker} aria-label={`Application status: ${status}`}>
            {steps.map((step) => (
                <li key={step.label} className={`${styles.step} ${styles[step.state]}`}>
                    <span className={styles.dot} aria-hidden="true">
                        {step.state === 'done' || step.state === 'offered' ? '✓' : step.state === 'rejected' ? '×' : ''}
                    </span>
                    <span className={styles.label}>{step.label}</span>
                    {dateFor(step.label) && <span className={styles.date}>{formatDate(dateFor(step.label))}</span>}
                </li>
            ))}
        </ol>
    )
}
