import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Alert, Card, EmptyState } from '../../components/common'
import { APPLICATION_STATUSES } from '../../constants/applicationStatus.js'
import useResumes from '../../hooks/useResumes.js'
import { listMyApplications } from '../../services/applicationApi.js'
import ApplicationCard from './ApplicationCard.jsx'
import styles from './Applications.module.css'

// Route: /applications — every job the user applied to, with status tracking.
export default function MyApplicationsPage() {
    const [apps, setApps] = useState(null)
    const [error, setError] = useState('')
    const [filter, setFilter] = useState('All')
    const [query, setQuery] = useState('')
    const [params] = useSearchParams()
    const highlight = params.get('highlight')
    const { resumes } = useResumes()

    useEffect(() => {
        listMyApplications().then(setApps).catch((e) => setError(e.message))
    }, [])

    useEffect(() => {
        if (apps && highlight) document.getElementById(`app-${highlight}`)?.scrollIntoView({ block: 'center' })
    }, [apps, highlight])

    const counts = useMemo(() => {
        const c = { All: apps?.length ?? 0 }
        for (const s of APPLICATION_STATUSES) c[s] = apps?.filter((a) => a.status === s).length ?? 0
        return c
    }, [apps])

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase()
        return (apps ?? []).filter(
            (a) =>
                (filter === 'All' || a.status === filter) &&
                (!q || `${a.job?.title} ${a.job?.company}`.toLowerCase().includes(q)),
        )
    }, [apps, filter, query])

    const resumeName = (id) => resumes.find((r) => r.id === id)?.file_name

    return (
        <div className={styles.appsWrap}>
            <div className={styles.appsHeader}>
                <div>
                    <h1 className={styles.pageTitle}>My applications</h1>
                    <p className={styles.muted}>Track every job you’ve applied to and where it stands.</p>
                </div>
                <Link to="/jobs" className={styles.primaryLink}>Find more jobs</Link>
            </div>

            {error && <Alert tone="error">{error}</Alert>}

            <div className={styles.statRow} role="tablist" aria-label="Filter by status">
                {['All', ...APPLICATION_STATUSES].map((s) => (
                    <button
                        key={s}
                        role="tab"
                        aria-selected={filter === s}
                        className={`${styles.stat} ${filter === s ? styles.statActive : ''}`}
                        onClick={() => setFilter(s)}
                    >
                        <span className={styles.statNum}>{counts[s]}</span>
                        <span className={styles.statLabel}>{s}</span>
                    </button>
                ))}
            </div>

            <Card className={styles.appsCard}>
                <div className={styles.searchRow}>
                    <input
                        type="search"
                        placeholder="Search by job title or company"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label="Search applications"
                    />
                </div>
                {apps === null ? (
                    <p className={styles.muted} style={{ padding: 20 }}>Loading applications…</p>
                ) : visible.length === 0 ? (
                    <div style={{ padding: 20 }}>
                        <EmptyState
                            icon="▤"
                            title={apps.length === 0 ? 'No applications yet' : 'Nothing matches this filter'}
                            action={apps.length === 0 && <Link to="/jobs" className={styles.primaryLink}>Browse jobs</Link>}
                        >
                            {apps.length === 0 ? 'When you apply to a job it will show up here so you can follow its progress.' : 'Try another status or clear the search.'}
                        </EmptyState>
                    </div>
                ) : (
                    <ul className={styles.appList}>
                        {visible.map((a) => (
                            <ApplicationCard key={a.id} app={a} resumeName={resumeName(a.resume_id)} highlighted={a.id === highlight} />
                        ))}
                    </ul>
                )}
            </Card>
        </div>
    )
}
