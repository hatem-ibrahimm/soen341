import { Link } from 'react-router-dom'
import { Card, CompanyLogo } from '../../components/common'
import { timeAgo } from '../../services/format.js'
import styles from './Applications.module.css'

// Compact job summary shown beside the application form.
export default function JobSummaryCard({ job, linkTitle = true }) {
    return (
        <Card className={styles.jobSummary}>
            <div className={styles.jobHead}>
                <CompanyLogo name={job.company} size={52} />
                <div>
                    <h2 className={styles.jobTitle}>
                        {linkTitle ? <Link to={`/jobs/${job.id}`} className={styles.jobLink}>{job.title}</Link> : job.title}
                    </h2>
                    <p className={styles.jobCompany}>{job.company}</p>
                </div>
            </div>
            <ul className={styles.jobFacts}>
                <li><span>Location</span>{job.location}</li>
                {job.type && <li><span>Type</span>{job.type}</li>}
                {job.salary && <li><span>Salary</span>{job.salary}</li>}
                {job.posted_at && <li><span>Posted</span>{timeAgo(job.posted_at)}</li>}
            </ul>
            {job.description && <p className={styles.jobDesc}>{job.description}</p>}
        </Card>
    )
}
