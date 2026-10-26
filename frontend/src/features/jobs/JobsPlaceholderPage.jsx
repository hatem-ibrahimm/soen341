import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Card, CompanyLogo } from '../../components/common'
import { listMyApplications } from '../../services/applicationApi.js'
import { listJobs } from '../../services/jobsApi.js'
import { timeAgo } from '../../services/format.js'
import styles from './JobsPlaceholderPage.module.css'

// TEMPORARY — stand-in for the Job Search & Listing feature (teammate's work).
// Replace this route's element with the real job listing page when it is merged.
// The only thing it needs to do for us: link "Apply" to /jobs/:jobId/apply
export default function JobsPlaceholderPage() {
    const [jobs, setJobs] = useState([])
    const [appliedIds, setAppliedIds] = useState(new Set())
    const [error, setError] = useState('')

    useEffect(() => {
        Promise.all([listJobs(), listMyApplications()])
            .then(([j, apps]) => {
                setJobs(j)
                setAppliedIds(new Set(apps.map((a) => a.job_id)))
            })
            .catch((e) => setError(e.message))
    }, [])

    return (
        <div className={styles.wrap}>
            <div className={styles.banner}>
                <strong>Placeholder job list.</strong> The real search &amp; filters come from the Job Listing feature. It only needs to link Apply to <code>/jobs/:jobId/apply</code>.
            </div>
            <h1 className={styles.h1}>Recommended jobs</h1>
            {error && <Alert tone="error">{error}</Alert>}
            <Card className={styles.listCard}>
                <ul className={styles.list}>
                    {jobs.map((job) => (
                        <li key={job.id} className={styles.job}>
                            <CompanyLogo name={job.company} />
                            <div className={styles.info}>
                                <h2><Link to={`/jobs/${job.id}`} className={styles.titleLink}>{job.title}</Link></h2>
                                <p>{job.company}</p>
                                <p className={styles.muted}>
                                    {job.location} · {job.type} · {job.salary}
                                </p>
                                <p className={styles.muted}>Posted {timeAgo(job.posted_at)}</p>
                            </div>
                            {appliedIds.has(job.id) ? (
                                <Link to="/applications" className={styles.applied}>
                                    ✓ Applied
                                </Link>
                            ) : (
                                <Link to={`/jobs/${job.id}/apply`} className={styles.apply}>
                                    Apply
                                </Link>
                            )}
                        </li>
                    ))}
                </ul>
            </Card>
        </div>
    )
}
