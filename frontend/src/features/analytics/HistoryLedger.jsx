import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '../../components/common'
import { APPLICATION_STATUSES } from '../../constants/applicationStatus.js'
import { timeAgo } from '../../services/format.js'
import { daysBetween, groupByMonth, plural } from './analyticsMath.js'
import styles from './Analytics.module.css'

// Every application, newest first, grouped by the month it was sent.
// Each row opens the application on the "My applications" page.
export default function HistoryLedger({ applications, selected, onSelect }) {
    const [query, setQuery] = useState('')

    const groups = useMemo(() => {
        const q = query.trim().toLowerCase()
        const visible = applications.filter(
            (a) =>
                (selected === 'All' || a.status === selected) &&
                (!q || `${a.job?.title ?? ''} ${a.job?.company ?? ''}`.toLowerCase().includes(q)),
        )
        return groupByMonth(visible)
    }, [applications, selected, query])

    return (
        <section className={styles.panel} aria-labelledby="history-title" id="history">
            <header className={styles.panelHead}>
                <div>
                    <h2 id="history-title">History</h2>
                    <p className={styles.panelNote}>Everything you’ve sent, newest first</p>
                </div>
                <input
                    type="search"
                    className={styles.historySearch}
                    placeholder="Search title or company"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Search application history"
                />
            </header>

            <div className={styles.chips} role="group" aria-label="Filter history by status">
                {['All', ...APPLICATION_STATUSES].map((s) => (
                    <button
                        type="button"
                        key={s}
                        aria-pressed={selected === s}
                        className={`${styles.chip} ${selected === s ? styles.chipOn : ''}`}
                        onClick={() => onSelect(s)}
                    >
                        {s}
                    </button>
                ))}
            </div>

            {groups.length === 0 ? (
                <p className={styles.nothing}>
                    Nothing here{selected !== 'All' ? ` with the status “${selected}”` : ''}
                    {query ? ` matching “${query}”` : ''}.
                </p>
            ) : (
                groups.map((g) => (
                    <div key={g.key} className={styles.month}>
                        <h3 className={styles.monthHead}>
                            <span>{g.label}</span>
                            <span className={styles.monthCount}>{plural(g.apps.length, 'application')}</span>
                        </h3>
                        <ol className={styles.ledger}>
                            {g.apps.map((a) => {
                                const d = new Date(a.applied_at)
                                const waiting = a.status === 'Applied' ? daysBetween(a.applied_at) : null
                                return (
                                    <li key={a.id}>
                                        <Link to={`/applications?highlight=${a.id}`} className={styles.ledgerRow}>
                                            <span className={styles.dateBlock} aria-hidden="true">
                                                <span className={styles.dateDay}>{d.getDate()}</span>
                                                <span className={styles.dateDow}>
                                                    {d.toLocaleDateString('en-CA', { weekday: 'short' })}
                                                </span>
                                            </span>
                                            <span className={styles.ledgerJob}>
                                                <strong>{a.job?.title ?? 'Job no longer available'}</strong>
                                                <span>
                                                    {a.job?.company ?? '—'}
                                                    {a.job?.location ? ` · ${a.job.location}` : ''}
                                                </span>
                                            </span>
                                            <span className={styles.ledgerStatus}>
                                                <StatusBadge status={a.status} />
                                                <span className={styles.ledgerWhen}>
                                                    {waiting !== null && waiting >= 14
                                                        ? `No reply in ${waiting} days`
                                                        : `Sent ${timeAgo(a.applied_at)}`}
                                                </span>
                                            </span>
                                        </Link>
                                    </li>
                                )
                            })}
                        </ol>
                    </div>
                ))
            )}
        </section>
    )
}
