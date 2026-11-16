import { APPLICATION_STATUSES, STATUS_CHART_COLOR } from '../../constants/applicationStatus.js'
import styles from './Analytics.module.css'

// Statuses whose colour is light enough to need dark text on top of it.
const DARK_TEXT = new Set(['Under Review', 'Offered'])

// One bar split into the five statuses, plus a legend you can click to filter
// the history list below. Counts come from GET /api/analytics/applications.
export default function StatusBreakdown({ byStatus, total, selected, onSelect }) {
    const parts = APPLICATION_STATUSES.map((status) => ({
        status,
        count: byStatus[status] ?? 0,
        share: total ? (byStatus[status] ?? 0) / total : 0,
    }))

    const describe = (p) => `${p.status}: ${p.count} (${Math.round(p.share * 100)}%)`

    return (
        <section className={styles.panel} aria-labelledby="breakdown-title">
            <header className={styles.panelHead}>
                <h2 id="breakdown-title">Where things stand</h2>
                <p className={styles.panelNote}>Current status of every application</p>
            </header>

            <div
                className={styles.splitBar}
                role="img"
                aria-label={`Status breakdown. ${parts.map(describe).join('. ')}`}
            >
                {parts
                    .filter((p) => p.count > 0)
                    .map((p) => (
                        <button
                            type="button"
                            key={p.status}
                            className={styles.splitPart}
                            style={{
                                flexGrow: p.count,
                                background: STATUS_CHART_COLOR[p.status],
                                color: DARK_TEXT.has(p.status) ? '#1d1f27' : '#fff',
                            }}
                            title={describe(p)}
                            aria-label={`Show only ${p.status}`}
                            onClick={() => onSelect(selected === p.status ? 'All' : p.status)}
                        >
                            {/* only print the share when the block is wide enough for it */}
                            {p.share >= 0.09 && <span>{Math.round(p.share * 100)}%</span>}
                        </button>
                    ))}
            </div>

            <ul className={styles.legend}>
                {parts.map((p) => (
                    <li key={p.status}>
                        <button
                            type="button"
                            className={`${styles.legendRow} ${selected === p.status ? styles.legendActive : ''}`}
                            onClick={() => onSelect(selected === p.status ? 'All' : p.status)}
                            aria-pressed={selected === p.status}
                        >
                            <span className={styles.swatch} style={{ background: STATUS_CHART_COLOR[p.status] }} />
                            <span className={styles.legendLabel}>{p.status}</span>
                            <span className={styles.legendCount}>{p.count}</span>
                        </button>
                    </li>
                ))}
            </ul>
            <p className={styles.hint}>Click a status to filter your history.</p>
        </section>
    )
}
