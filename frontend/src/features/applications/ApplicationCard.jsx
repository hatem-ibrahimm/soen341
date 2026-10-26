import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CompanyLogo, StatusBadge } from '../../components/common'
import { confirmationNumber, formatDate, timeAgo } from '../../services/format.js'
import StatusTracker from './StatusTracker.jsx'
import styles from './Applications.module.css'

export default function ApplicationCard({ app, resumeName, highlighted }) {
    const [open, setOpen] = useState(Boolean(highlighted))
    const job = app.job ?? { title: 'Job no longer available', company: '—' }

    return (
        <li className={`${styles.appCard} ${highlighted ? styles.highlight : ''}`} id={`app-${app.id}`}>
            <div className={styles.appTop}>
                <CompanyLogo name={job.company} />
                <div className={styles.appInfo}>
                    <h3>{app.job ? <Link to={`/jobs/${app.job_id}`} className={styles.jobLink}>{job.title}</Link> : job.title}</h3>
                    <p>{job.company}{job.location && ` · ${job.location}`}</p>
                    <p className={styles.small}>Applied {timeAgo(app.applied_at)}</p>
                </div>
                <StatusBadge status={app.status} />
            </div>

            <div className={styles.trackerWrap}>
                <StatusTracker status={app.status} history={app.status_history} />
            </div>

            <button className={styles.detailsToggle} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
                {open ? 'Hide details ▲' : 'Show details ▼'}
            </button>

            {open && (
                <div className={styles.details}>
                    <div>
                        <h4>Activity</h4>
                        <ul className={styles.timeline}>
                            {[...(app.status_history ?? [])].reverse().map((h) => (
                                <li key={h.status + h.changed_at}>
                                    <StatusBadge status={h.status} />
                                    <span>{formatDate(h.changed_at)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <h4>What you sent</h4>
                        <dl className={styles.confirmFacts}>
                            <dt>Resume</dt>
                            <dd>{resumeName ?? 'Resume'}</dd>
                              {app.cover_letter && (
                                <>
                                    <dt>Cover letter</dt>
                                    <dd><span className={styles.coverText}>{app.cover_letter}</span></dd>
                                </>
                                )}
                            <dt>Confirmation #</dt>
                            <dd><code>{confirmationNumber(app.id)}</code></dd>
                        </dl>
                    </div>
                    {app.job && (
                        <div className={styles.jobSnapshot}>
                            <h4>Job posting</h4>
                            <dl className={styles.confirmFacts}>
                                {job.type && (<><dt>Type</dt><dd>{job.type}</dd></>)}
                                {job.salary && (<><dt>Salary</dt><dd>{job.salary}</dd></>)}
                            </dl>
                            {job.description && <p>{job.description}</p>}
                            <p><Link to={`/jobs/${app.job_id}`} className={styles.jobLink}>View full job posting</Link></p>
                        </div>
                    )}
                </div>
            )}
        </li>
    )
}
