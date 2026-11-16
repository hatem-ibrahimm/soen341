import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Alert, Card, CompanyLogo } from '../../components/common'
import { findApplicationForJob } from '../../services/applicationApi.js'
import { formatJobSalary } from '../../services/jobApi.js'
import { getJob } from '../../services/jobsApi.js'
import { timeAgo } from '../../services/format.js'
import styles from './JobsPlaceholderPage.module.css'

export default function JobDetailsPlaceholderPage() {
    const { jobId } = useParams()
    const location = useLocation()
    const [result, setResult] = useState(null)
    const [retryCount, setRetryCount] = useState(0)
    const requestKey = JSON.stringify([jobId, retryCount])

    useEffect(() => {
        let active = true

        Promise.all([getJob(jobId), findApplicationForJob(jobId)])
            .then(([loadedJob, application]) => {
                if (!active) return
                setResult({
                    key: requestKey,
                    job: loadedJob,
                    applied: application,
                    error: '',
                })
            })
            .catch((requestError) => {
                if (active) {
                    setResult({
                        key: requestKey,
                        job: null,
                        applied: null,
                        error: requestError.message || 'Unable to load this job.',
                    })
                }
            })

        return () => {
            active = false
        }
    }, [jobId, retryCount, requestKey])

    const current = result?.key === requestKey ? result : null

    if (current?.error) {
        return (
            <div className={styles.wrap}>
                <Alert tone="error">{current.error}</Alert>
                <button type="button" onClick={() => setRetryCount((count) => count + 1)}>
                    Retry
                </button>
                <Link to={`/jobs${location.search}`} className={styles.back}>← Back to jobs</Link>
            </div>
        )
    }

    if (!current?.job) {
        return <p className={styles.loading} role="status">Loading job…</p>
    }

    const { job, applied } = current
    const company = job.company_name ?? job.company
    const category = job.category ?? job.type
    const salary = job.salary || formatJobSalary(job)

    return (
        <div className={styles.wrap}>
            <Link to={`/jobs${location.search}`} className={styles.back}>← Back to jobs</Link>
            <Card className={styles.detailCard}>
                <header className={styles.detailHeader}>
                    <CompanyLogo name={company} size={60} />
                    <div>
                        <h1 className={styles.detailTitle}>{job.title}</h1>
                        <p className={styles.detailCompany}>{company}</p>
                    </div>
                </header>

                <dl className={styles.detailFacts}>
                    {job.location && <div><dt>Location</dt><dd>{job.location}</dd></div>}
                    {category && <div><dt>Category</dt><dd>{category}</dd></div>}
                    {job.type && job.type !== category && <div><dt>Employment type</dt><dd>{job.type}</dd></div>}
                    {salary && <div><dt>Salary</dt><dd>{salary}</dd></div>}
                    {job.posted_at && <div><dt>Posted</dt><dd>{timeAgo(job.posted_at)}</dd></div>}
                </dl>

                {job.description && (
                    <section className={styles.detailSection}>
                        <h2>About the role</h2>
                        <p>{job.description}</p>
                    </section>
                )}

                <section className={styles.detailSection}>
                    <h2>Required skills</h2>
                    {job.required_skills?.length ? (
                        <ul className={styles.skills}>
                            {job.required_skills.map((skill) => <li key={skill}>{skill}</li>)}
                        </ul>
                    ) : (
                        <p className={styles.muted}>No specific skills were listed.</p>
                    )}
                </section>
            </Card>
            <div className={styles.detailActions}>
                {applied ? (
                    <Link to={`/applications?highlight=${applied.id}`} className={styles.applied}>
                        ✓ Applied · view status
                    </Link>
                ) : (
                    <Link to={`/jobs/${job.id}/apply`} className={styles.apply}>Apply now</Link>
                )}
            </div>
        </div>
    )
}
