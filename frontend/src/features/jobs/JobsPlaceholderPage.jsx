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
    const [search, setSearch] = useState('')

    useEffect(() => {
        Promise.all([listJobs(), listMyApplications()])
            .then(([j, apps]) => {
                setJobs(j)
                setAppliedIds(new Set(apps.map((a) => a.job_id)))
            })
            .catch((e) => setError(e.message))
    }, [])

    const normalizedSearch = search.trim().toLocaleLowerCase()
    const filteredJobs = jobs.filter((job) =>
        [job.title, job.company, job.location, job.type, job.salary]
            .some((value) => value?.toLocaleLowerCase().includes(normalizedSearch)),
    )

    return (
        <div className={styles.wrap}>
            <div className={styles.banner}>
                <strong>Placeholder job list.</strong> This page provides basic keyword search; full search and filters come from the Job Listing feature. Apply links to <code>/jobs/:jobId/apply</code>.
            </div>
            <h1 className={styles.h1}>Recommended jobs</h1>
            {error && <Alert tone="error">{error}</Alert>}
            <label className={styles.searchLabel} htmlFor="job-search">
                Search jobs
            </label>
            <input
                className={styles.searchInput}
                id="job-search"
                type="search"
                placeholder="Search by title, company, location, or type"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
            />
            <Card className={styles.listCard}>
                <ul className={styles.list}>
                    {filteredJobs.map((job) => (
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
                {!error && filteredJobs.length === 0 && (
                    <p className={styles.emptyState} role="status">
                        {jobs.length === 0
                            ? 'No jobs are available.'
                            : 'No jobs match your search.'}
                    </p>
                )}
            </Card>
        </div>
    )
}
