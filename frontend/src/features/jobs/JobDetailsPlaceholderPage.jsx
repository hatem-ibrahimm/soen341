import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert } from '../../components/common'
import { findApplicationForJob } from '../../services/applicationApi.js'
import { getJob } from '../../services/jobsApi.js'
import JobSummaryCard from '../applications/JobSummaryCard.jsx'
import styles from './JobsPlaceholderPage.module.css'

// TEMPORARY: stand-in for the job details page from the Job Listing feature.
// When the real one is merged, it only needs an Apply button linking to /jobs/:jobId/apply
export default function JobDetailsPlaceholderPage() {
    const { jobId } = useParams()
    const [job, setJob] = useState(null)
    const [applied, setApplied] = useState(null)
    const [error, setError] = useState('')

    useEffect(() => {
        Promise.all([getJob(jobId), findApplicationForJob(jobId)])
            .then(([j, app]) => {
                setJob(j)
                setApplied(app)
            })
            .catch((e) => setError(e.message))
    }, [jobId])

    if (error) return <Alert tone="error">{error}</Alert>
    if (!job) return <p>Loading…</p>

    return (
        <div className={styles.wrap}>
            <div className={styles.banner}>
                <strong>Placeholder job details.</strong> The real page comes from the Job Listing feature.
            </div>
            <Link to="/jobs" className={styles.back}>← Back to jobs</Link>
            <JobSummaryCard job={job} linkTitle={false} />
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
