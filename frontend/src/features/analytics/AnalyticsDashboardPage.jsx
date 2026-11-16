import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, EmptyState } from '../../components/common'
import { formatDate } from '../../services/format.js'
import { getApplicationAnalytics } from '../../services/analyticsApi.js'
import ActivityChart from './ActivityChart.jsx'
import HistoryLedger from './HistoryLedger.jsx'
import StatusBreakdown from './StatusBreakdown.jsx'
import { plural, summarize } from './analyticsMath.js'
import styles from './Analytics.module.css'

// Route: /dashboard — Application Analytics and History Dashboard (Sprint 3).
export default function AnalyticsDashboardPage() {
    const [data, setData] = useState(null)
    const [error, setError] = useState('')
    const [statusFilter, setStatusFilter] = useState('All')

    useEffect(() => {
        getApplicationAnalytics()
            .then(setData)
            .catch((e) => setError(e.message))
    }, [])

    const facts = useMemo(
        () => (data ? summarize(data.applications, data.byStatus, data.total) : null),
        [data],
    )

    function filterHistory(status) {
        setStatusFilter(status)
        if (status !== 'All') {
            document.getElementById('history')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }

    if (error) {
        return (
            <div className={styles.page}>
                <h1 className={styles.title}>Your job search, so far</h1>
                <Alert tone="error">{error}</Alert>
            </div>
        )
    }

    if (!data) {
        return (
            <div className={styles.page}>
                <h1 className={styles.title}>Your job search, so far</h1>
                <p className={styles.loading}>Adding up your applications…</p>
            </div>
        )
    }

    if (data.total === 0) {
        return (
            <div className={styles.page}>
                <h1 className={styles.title}>Your job search, so far</h1>
                <EmptyState
                    icon="▁▃▅"
                    title="Nothing to chart yet"
                    action={<Link to="/jobs" className={styles.primaryLink}>Browse jobs</Link>}
                >
                    Once you apply to a job, this page shows how your applications are doing and how
                    active you’ve been each week.
                </EmptyState>
            </div>
        )
    }

    const { byStatus, total } = data
    const weekDelta = facts.thisWeek - facts.lastWeek

    return (
        <div className={styles.page}>
            <div className={styles.heading}>
                <div>
                    <h1 className={styles.title}>Your job search, so far</h1>
                    <p className={styles.subtitle}>Since {formatDate(facts.first)}</p>
                </div>
                <Link to="/applications" className={styles.secondaryLink}>Open my applications</Link>
            </div>

            <section className={styles.overview} aria-label="Summary">
                <div className={styles.hero}>
                    <span className={styles.heroNumber}>{total}</span>
                    <p className={styles.heroText}>
                        {total === 1 ? 'application sent.' : 'applications sent.'}{' '}
                        {facts.heardBack > 0 ? (
                            <>
                                <strong>{facts.heardBack}</strong> got a reply
                                {byStatus.Interview > 0 && <>, <strong>{plural(byStatus.Interview, 'interview')}</strong> in progress</>}
                                {byStatus.Offered > 0 && <> and <strong>{plural(byStatus.Offered, 'offer')}</strong> on the table</>}
                                .
                            </>
                        ) : (
                            'No replies yet. That’s normal in the first couple of weeks.'
                        )}
                    </p>
                </div>

                <dl className={styles.facts}>
                    <div>
                        <dt>Reply rate</dt>
                        <dd>{facts.responseRate}%</dd>
                        <p>{facts.heardBack} of {total} moved past “Applied”</p>
                    </div>
                    <div>
                        <dt>This week</dt>
                        <dd>{facts.thisWeek}</dd>
                        <p>
                            {weekDelta === 0
                                ? 'Same as last week'
                                : `${weekDelta > 0 ? '+' : '−'}${Math.abs(weekDelta)} vs last week`}
                        </p>
                    </div>
                    <div>
                        <dt>Usual pace</dt>
                        <dd>{facts.perWeek.toFixed(1)}</dd>
                        <p>applications a week</p>
                    </div>
                    <div>
                        <dt>Waiting longest</dt>
                        {facts.longestWait ? (
                            <>
                                <dd>{plural(facts.longestWait.days, 'day')}</dd>
                                <p>{facts.longestWait.app.job?.company ?? 'Unknown company'} · maybe follow up?</p>
                            </>
                        ) : (
                            <>
                                <dd>—</dd>
                                <p>Every application has an answer</p>
                            </>
                        )}
                    </div>
                </dl>
            </section>

            <div className={styles.grid}>
                <StatusBreakdown
                    byStatus={byStatus}
                    total={total}
                    selected={statusFilter}
                    onSelect={filterHistory}
                />
                <ActivityChart applications={data.applications} />
            </div>

            <HistoryLedger
                applications={data.applications}
                selected={statusFilter}
                onSelect={setStatusFilter}
            />
        </div>
    )
}
