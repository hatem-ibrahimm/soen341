import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, CompanyLogo, StatusBadge } from '../../components/common'
import { getApplication } from '../../services/applicationApi.js'
import { confirmationNumber, formatDate } from '../../services/format.js'
import styles from './Applications.module.css'

// Route: /applications/:applicationId/submitted — confirmation after applying.
export default function ApplicationSubmittedPage() {
    const { applicationId } = useParams()
    const [app, setApp] = useState(null)
    const [error, setError] = useState('')

    useEffect(() => {
        getApplication(applicationId).then(setApp).catch((e) => setError(e.message))
    }, [applicationId])

    if (error) return <Alert tone="error">{error}</Alert>
    if (!app) return <p className={styles.muted}>Loading…</p>

    return (
        <div className={styles.confirmWrap}>
            <div className={styles.confirmCard} role="status">
                <div className={styles.checkCircle} aria-hidden="true">✓</div>
                <h1>Application submitted!</h1>
                <p className={styles.muted}>
                    Your application was sent to <strong>{app.job?.company}</strong>. We’ll update the status here as the recruiter reviews it.
                </p>

                <div className={styles.confirmJob}>
                    <CompanyLogo name={app.job?.company} size={44} />
                    <div>
                        <strong>{app.job?.title}</strong>
                        <span>{app.job?.company} · {app.job?.location}</span>
                    </div>
                    <StatusBadge status={app.status} />
                </div>

                <dl className={styles.confirmFacts}>
                    <dt>Submitted</dt>
                    <dd>{formatDate(app.applied_at)}</dd>
                    <dt>Confirmation #</dt>
                    <dd><code>{confirmationNumber(app.id)}</code></dd>
                </dl>

                <div className={styles.confirmActions}>
                    <Link to={`/applications?highlight=${app.id}`} className={styles.primaryLink}>Track my applications</Link>
                    <Link to="/jobs" className={styles.secondaryLink}>Browse more jobs</Link>
                </div>
            </div>
        </div>
    )
}
