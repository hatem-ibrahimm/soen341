import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { APPLICATION_STATUSES } from '../constants/applicationStatus.js'
import { formatDate } from '../services/format.js'
import {
    getRecruiterApplication,
    getRecruiterResumeDownload,
    listRecruiterApplications,
    updateRecruiterApplicationStatus,
} from '../services/recruiterApi.js'
import {
    listRecruiterInterviews,
    scheduleRecruiterInterview,
    updateRecruiterInterview,
} from '../services/interviewsApi.js'

export default function RecruiterApplicants({ job }) {
    const [expanded, setExpanded] = useState(false)
    const [applications, setApplications] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [actionError, setActionError] = useState('')
    const [notice, setNotice] = useState('')
    const [selectedId, setSelectedId] = useState(null)
    const [details, setDetails] = useState(null)
    const [interviews, setInterviews] = useState([])
    const [interviewDraft, setInterviewDraft] = useState({ scheduled_at: '', location: '', notes: '' })
    const [savingInterview, setSavingInterview] = useState(false)
    const [updatingInterviewId, setUpdatingInterviewId] = useState(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [resumeLoadingId, setResumeLoadingId] = useState(null)
    const [resumeLinks, setResumeLinks] = useState({})
    const [updatingId, setUpdatingId] = useState(null)
    const [statusFilter, setStatusFilter] = useState('All')
    const [dateSort, setDateSort] = useState('newest')

    const visibleApplications = useMemo(() => {
        if (!applications) return []
        return applications
            .filter((application) =>
                statusFilter === 'All' || application.status === statusFilter,
            )
            .sort((a, b) => {
                const difference =
                    new Date(a.submitted_at).getTime() -
                    new Date(b.submitted_at).getTime()
                return dateSort === 'newest' ? -difference : difference
            })
    }, [applications, dateSort, statusFilter])

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
        setInterviews([])
        setActionError('')
        setDetailLoading(true)
        try {
            const [applicationDetails, scheduledInterviews] = await Promise.all([
                getRecruiterApplication(applicationId),
                listRecruiterInterviews(applicationId),
            ])
            setDetails(applicationDetails)
            setInterviews(scheduledInterviews)
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

    async function scheduleInterview(event, applicationId) {
        event.preventDefault()
        setSavingInterview(true)
        setActionError('')
        setNotice('')
        try {
            const created = await scheduleRecruiterInterview(applicationId, {
                ...interviewDraft,
                scheduled_at: new Date(interviewDraft.scheduled_at).toISOString(),
            })
            setInterviews((current) => [...current, created])
            setInterviewDraft({ scheduled_at: '', location: '', notes: '' })
            setNotice('Interview scheduled. The applicant has been notified.')
        } catch (requestError) {
            setActionError(requestError.message || 'Unable to schedule the interview.')
        } finally {
            setSavingInterview(false)
        }
    }

    async function updateInterviewStatus(applicationId, interviewId, status) {
        setUpdatingInterviewId(interviewId)
        setActionError('')
        setNotice('')
        try {
            const updated = await updateRecruiterInterview(applicationId, interviewId, status)
            setInterviews((current) => current.map((item) =>
                String(item.id) === String(interviewId) ? updated : item,
            ))
            setNotice('Interview status updated.')
        } catch (requestError) {
            setActionError(requestError.message || 'Unable to update interview status.')
        } finally {
            setUpdatingInterviewId(null)
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
                        <>
                            <div className="recruiter-applicant-filters">
                                <label>
                                    Status
                                    <select
                                        value={statusFilter}
                                        onChange={(event) => setStatusFilter(event.target.value)}
                                    >
                                        <option value="All">All statuses</option>
                                        {APPLICATION_STATUSES.map((status) => (
                                            <option key={status} value={status}>{status}</option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    Sort by date
                                    <select
                                        value={dateSort}
                                        onChange={(event) => setDateSort(event.target.value)}
                                    >
                                        <option value="newest">Newest first</option>
                                        <option value="oldest">Oldest first</option>
                                    </select>
                                </label>
                            </div>
                            <ul className="recruiter-applicant-list">
                            {visibleApplications.map((application) => {
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
                                            <div className="recruiter-applicant-actions">
                                                <Link
                                                    className="recruiter-secondary-button"
                                                    to={`/recruiter/applications/${encodeURIComponent(application.id)}/profile`}
                                                >
                                                    View full profile
                                                </Link>
                                                <button
                                                    type="button"
                                                    className="recruiter-text-button"
                                                    aria-expanded={selectedId === application.id}
                                                    onClick={() => toggleDetails(application.id)}
                                                >
                                                    {selectedId === application.id ? 'Hide review' : 'Review'}
                                                </button>
                                            </div>
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
                                                        <p>
                                                            {[details.applicant?.first_name, details.applicant?.last_name]
                                                                .filter(Boolean)
                                                                .join(' ') || 'Candidate'}
                                                        </p>
                                                        <p>{details.applicant?.email || 'No email provided'}</p>
                                                        {details.applicant?.title && <p>{details.applicant.title}</p>}
                                                        {details.applicant?.phone_number && <p>{details.applicant.phone_number}</p>}
                                                        {details.applicant?.location && <p>{details.applicant.location}</p>}
                                                        {details.applicant?.bio && <p>{details.applicant.bio}</p>}
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
                                                        <h4>Interviews</h4>
                                                        {interviews.length ? (
                                                            <ul className="recruiter-interview-list">
                                                                {interviews.map((interview) => (
                                                                    <li key={interview.id}>
                                                                        <strong>{new Date(interview.scheduled_at).toLocaleString()}</strong>
                                                                        {interview.location && <span>{interview.location}</span>}
                                                                        {interview.notes && <p>{interview.notes}</p>}
                                                                        <label>
                                                                            Status
                                                                            <select
                                                                                value={interview.status}
                                                                                disabled={updatingInterviewId === interview.id}
                                                                                onChange={(event) => updateInterviewStatus(
                                                                                    application.id,
                                                                                    interview.id,
                                                                                    event.target.value,
                                                                                )}
                                                                            >
                                                                                <option value="scheduled">Scheduled</option>
                                                                                <option value="completed">Completed</option>
                                                                                <option value="cancelled">Cancelled</option>
                                                                            </select>
                                                                        </label>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        ) : (
                                                            <p>No interviews scheduled.</p>
                                                        )}
                                                        <form
                                                            className="recruiter-interview-form"
                                                            onSubmit={(event) => scheduleInterview(event, application.id)}
                                                        >
                                                            <label>
                                                                Schedule date and time
                                                                <input
                                                                    type="datetime-local"
                                                                    required
                                                                    value={interviewDraft.scheduled_at}
                                                                    onChange={(event) => setInterviewDraft((current) => ({
                                                                        ...current,
                                                                        scheduled_at: event.target.value,
                                                                    }))}
                                                                />
                                                            </label>
                                                            <label>
                                                                Location or meeting link
                                                                <input
                                                                    type="text"
                                                                    maxLength={500}
                                                                    value={interviewDraft.location}
                                                                    onChange={(event) => setInterviewDraft((current) => ({
                                                                        ...current,
                                                                        location: event.target.value,
                                                                    }))}
                                                                />
                                                            </label>
                                                            <label>
                                                                Notes
                                                                <textarea
                                                                    maxLength={2000}
                                                                    value={interviewDraft.notes}
                                                                    onChange={(event) => setInterviewDraft((current) => ({
                                                                        ...current,
                                                                        notes: event.target.value,
                                                                    }))}
                                                                />
                                                            </label>
                                                            <button
                                                                type="submit"
                                                                className="recruiter-secondary-button"
                                                                disabled={savingInterview}
                                                            >
                                                                {savingInterview ? 'Scheduling…' : 'Schedule interview'}
                                                            </button>
                                                        </form>
                                                    </>
                                                ) : null}
                                            </div>
                                        )}
                                    </li>
                                )
                            })}
                            </ul>
                            {visibleApplications.length === 0 && (
                                <p className="recruiter-empty">No applicants match this status.</p>
                            )}
                        </>
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
