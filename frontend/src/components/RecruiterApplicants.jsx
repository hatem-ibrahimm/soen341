import { useState } from 'react'
import { APPLICATION_STATUSES } from '../constants/applicationStatus.js'
import { formatDate } from '../services/format.js'
import {
    getRecruiterApplication,
    getRecruiterResumeDownload,
    listRecruiterApplications,
    updateRecruiterApplicationStatus,
} from '../services/recruiterApi.js'

export default function RecruiterApplicants({ job }) {
    const [expanded, setExpanded] = useState(false)
    const [applications, setApplications] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [actionError, setActionError] = useState('')
    const [notice, setNotice] = useState('')
    const [selectedId, setSelectedId] = useState(null)
    const [details, setDetails] = useState(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [resumeLoadingId, setResumeLoadingId] = useState(null)
    const [resumeLinks, setResumeLinks] = useState({})
    const [updatingId, setUpdatingId] = useState(null)

    async function loadApplications() {
        setLoading(true)
        setError('')
        try {
            setApplications(await listRecruiterApplications(job.id))
        } catch (requestError) {
            setError(requestError.message || 'Unable to load applicants.')
        } finally {
            setLoading(false)
        }
    }

    function toggleExpanded() {
        const nextExpanded = !expanded
        setExpanded(nextExpanded)
        if (nextExpanded && applications === null && !loading) loadApplications()
    }

    async function toggleDetails(applicationId) {
        if (selectedId === applicationId) {
            setSelectedId(null)
            setDetails(null)
            return
        }
        setSelectedId(applicationId)
        setDetails(null)
        setActionError('')
        setDetailLoading(true)
        try {
            setDetails(await getRecruiterApplication(applicationId))
        } catch (requestError) {
            setActionError(requestError.message || 'Unable to load candidate details.')
        } finally {
            setDetailLoading(false)
        }
    }

    async function loadResume(applicationId) {
        setResumeLoadingId(applicationId)
        setActionError('')
        try {
            const resume = await getRecruiterResumeDownload(applicationId)
            setResumeLinks((current) => ({ ...current, [applicationId]: resume }))
        } catch (requestError) {
            setActionError(requestError.message || 'Unable to load the candidate resume.')
        } finally {
            setResumeLoadingId(null)
        }
    }

    async function updateStatus(applicationId, status) {
        setUpdatingId(applicationId)
        setActionError('')
        setNotice('')
        try {
            const updated = await updateRecruiterApplicationStatus(applicationId, status)
            setApplications((current) =>
                current.map((application) =>
                    String(application.id) === String(applicationId)
                        ? { ...application, status: updated.status }
                        : application,
                ),
            )
            setDetails((current) =>
                current?.id === applicationId
                    ? { ...current, status: updated.status }
                    : current,
            )
            setNotice('Application status updated. The applicant has been notified.')
        } catch (requestError) {
            setActionError(requestError.message || 'Unable to update application status.')
        } finally {
            setUpdatingId(null)
        }
    }

    return (
        <section className="recruiter-applicants" aria-label={`Applicants for ${job.title}`}>
            <button
                type="button"
                className="recruiter-secondary-button"
                aria-expanded={expanded}
                onClick={toggleExpanded}
            >
                {expanded ? 'Hide applicants' : 'Review applicants'}
                {applications && ` (${applications.length})`}
            </button>
            {expanded && (
                <div className="recruiter-applicants-panel">
                    {loading ? (
                        <p role="status">Loading applicants…</p>
                    ) : error ? (
                        <div className="recruiter-applicant-error" role="alert">
                            <span>{error}</span>
                            <button type="button" onClick={loadApplications}>Retry</button>
                        </div>
                    ) : applications?.length ? (
                        <ul className="recruiter-applicant-list">
                            {applications.map((application) => {
                                const applicant = application.applicant ?? {}
                                const name = [applicant.first_name, applicant.last_name]
                                    .filter(Boolean)
                                    .join(' ') || 'Candidate'
                                const resume = application.resume
                                const resumeLink = resumeLinks[application.id]
                                return (
                                    <li key={application.id} className="recruiter-applicant">
                                        <div className="recruiter-applicant-heading">
                                            <div>
                                                <strong>{name}</strong>
                                                {applicant.email && (
                                                    <a href={`mailto:${applicant.email}`}>{applicant.email}</a>
                                                )}
                                                <small>Applied {formatDate(application.submitted_at)}</small>
                                            </div>
                                            <button
                                                type="button"
                                                className="recruiter-text-button"
                                                aria-expanded={selectedId === application.id}
                                                onClick={() => toggleDetails(application.id)}
                                            >
                                                {selectedId === application.id ? 'Hide review' : 'Review'}
                                            </button>
                                        </div>
                                        <label className="recruiter-applicant-status">
                                            Application status
                                            <select
                                                value={application.status}
                                                disabled={updatingId === application.id}
                                                onChange={(event) => updateStatus(application.id, event.target.value)}
                                            >
                                                {APPLICATION_STATUSES.map((status) => (
                                                    <option key={status} value={status}>{status}</option>
                                                ))}
                                            </select>
                                        </label>
                                        {selectedId === application.id && (
                                            <div className="recruiter-applicant-details">
                                                {detailLoading ? (
                                                    <p role="status">Loading candidate details…</p>
                                                ) : details ? (
                                                    <>
                                                        <h4>Candidate profile</h4>
                                                        <p>{details.applicant?.email || 'No email provided'}</p>
                                                        <h4>Cover letter</h4>
                                                        <p className="recruiter-cover-letter">
                                                            {details.cover_letter || 'No cover letter submitted.'}
                                                        </p>
                                                        <h4>Resume</h4>
                                                        {resume ? (
                                                            resumeLink ? (
                                                                <a href={resumeLink.download_url} target="_blank" rel="noreferrer">
                                                                    Open {resumeLink.file_name}
                                                                </a>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    className="recruiter-text-button"
                                                                    disabled={resumeLoadingId === application.id}
                                                                    onClick={() => loadResume(application.id)}
                                                                >
                                                                    {resumeLoadingId === application.id
                                                                        ? 'Preparing resume…'
                                                                        : `Open ${resume.file_name}`}
                                                                </button>
                                                            )
                                                        ) : (
                                                            <p>No resume attached.</p>
                                                        )}
                                                    </>
                                                ) : null}
                                            </div>
                                        )}
                                    </li>
                                )
                            })}
                        </ul>
                    ) : (
                        <p className="recruiter-empty">No applications have been submitted for this posting.</p>
                    )}
                    {actionError && <p className="recruiter-error" role="alert">{actionError}</p>}
                    {notice && <p className="recruiter-notice" role="status">{notice}</p>}
                </div>
            )}
        </section>
    )
}
