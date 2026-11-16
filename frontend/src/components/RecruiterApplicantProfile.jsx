import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { formatDate } from '../services/format.js'
import {
    getRecruiterApplication,
    getRecruiterResumeDownload,
} from '../services/recruiterApi.js'

export default function RecruiterApplicantProfile() {
    const { applicationId } = useParams()
    const [application, setApplication] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [resume, setResume] = useState(null)
    const [resumeLoading, setResumeLoading] = useState(false)
    const [resumeError, setResumeError] = useState('')

    useEffect(() => {
        let active = true
        getRecruiterApplication(applicationId)
            .then((result) => active && setApplication(result))
            .catch((requestError) => active && setError(requestError.message))
            .finally(() => active && setLoading(false))
        return () => {
            active = false
        }
    }, [applicationId])

    async function openResume() {
        setResumeLoading(true)
        setResumeError('')
        try {
            setResume(await getRecruiterResumeDownload(applicationId))
        } catch (requestError) {
            setResumeError(requestError.message || 'Unable to open the applicant resume.')
        } finally {
            setResumeLoading(false)
        }
    }

    if (loading) {
        return <p className="recruiter-profile-placeholder" role="status">Loading applicant profile…</p>
    }

    if (error || !application) {
        return (
            <main className="recruiter-candidate-profile">
                <Link to="/recruiter" className="recruiter-profile-back">Back to recruiter dashboard</Link>
                <p className="recruiter-error" role="alert">{error || 'Applicant profile not found.'}</p>
            </main>
        )
    }

    const applicant = application.applicant ?? {}
    const name = [applicant.first_name, applicant.last_name].filter(Boolean).join(' ') || 'Candidate'

    return (
        <main className="recruiter-candidate-profile">
            <Link to="/recruiter" className="recruiter-profile-back">Back to recruiter dashboard</Link>
            <header className="recruiter-candidate-header">
                <p className="recruiter-eyebrow">Applicant profile</p>
                <h1>{name}</h1>
                {applicant.title && <p>{applicant.title}</p>}
            </header>

            <section className="recruiter-candidate-card" aria-labelledby="candidate-contact-heading">
                <h2 id="candidate-contact-heading">Contact information</h2>
                <dl className="recruiter-candidate-contact">
                    {[
                        ['Email', applicant.email],
                        ['Phone', applicant.phone_number],
                        ['Location', applicant.location],
                    ].map(([label, value]) => value && (
                        <div key={label}>
                            <dt>{label}</dt>
                            <dd>{label === 'Email' ? <a href={`mailto:${value}`}>{value}</a> : value}</dd>
                        </div>
                    ))}
                </dl>
                {applicant.bio && (
                    <>
                        <h3>About</h3>
                        <p className="recruiter-candidate-text">{applicant.bio}</p>
                    </>
                )}
            </section>

            {application.experiences?.length > 0 && (
                <section className="recruiter-candidate-card">
                    <h2>Experience</h2>
                    {application.experiences.map((item, index) => (
                        <article className="recruiter-candidate-entry" key={item.id ?? `${item.job_title}-${index}`}>
                            <h3>{item.job_title}</h3>
                            <p>{item.company}</p>
                            {item.dates && <small>{item.dates}</small>}
                            {item.description && <p className="recruiter-candidate-text">{item.description}</p>}
                        </article>
                    ))}
                </section>
            )}

            {application.education?.length > 0 && (
                <section className="recruiter-candidate-card">
                    <h2>Education</h2>
                    {application.education.map((item, index) => (
                        <article className="recruiter-candidate-entry" key={item.id ?? `${item.school}-${index}`}>
                            <h3>{item.school}</h3>
                            {item.degree && <p>{item.degree}</p>}
                            {item.years && <small>{item.years}</small>}
                        </article>
                    ))}
                </section>
            )}

            {application.skills?.length > 0 && (
                <section className="recruiter-candidate-card">
                    <h2>Skills</h2>
                    <ul className="recruiter-candidate-skills">
                        {application.skills.map((skill) => <li key={skill}>{skill}</li>)}
                    </ul>
                </section>
            )}

            <section className="recruiter-candidate-card">
                <h2>Application</h2>
                <p><strong>Status:</strong> {application.status}</p>
                <p><strong>Applied:</strong> {formatDate(application.submitted_at)}</p>
                <h3>Cover letter</h3>
                <p className="recruiter-candidate-text">
                    {application.cover_letter || 'No cover letter submitted.'}
                </p>
                <h3>Resume</h3>
                {resume ? (
                    <a href={resume.download_url} target="_blank" rel="noreferrer">
                        Open {resume.file_name}
                    </a>
                ) : application.resume ? (
                    <button
                        type="button"
                        className="recruiter-secondary-button"
                        disabled={resumeLoading}
                        onClick={openResume}
                    >
                        {resumeLoading ? 'Preparing resume…' : `Open ${application.resume.file_name}`}
                    </button>
                ) : (
                    <p>No resume attached.</p>
                )}
                {resumeError && <p className="recruiter-error" role="alert">{resumeError}</p>}
            </section>
        </main>
    )
}
