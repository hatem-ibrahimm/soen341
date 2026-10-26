import { useEffect, useState } from 'react'
import {
    Link,
    useLocation,
    useParams,
} from 'react-router-dom'
import {
    formatJobSalary,
    getJob,
    JOBS_DATA_MODE,
} from '../services/jobApi.js'
import './JobDetails.css'

function JobDetails({ renderApplicationAction }) {
    const { jobId } = useParams()
    const location = useLocation()
    const [retryCount, setRetryCount] = useState(0)

    const [result, setResult] = useState({
        key: '',
        status: 'loading',
        job: null,
        message: '',
    })

    const requestKey = JSON.stringify([jobId, retryCount])

    useEffect(() => {
        let active = true
        const key = JSON.stringify([jobId, retryCount])

        getJob(jobId)
            .then((job) => {
                if (!active) return

                setResult({
                    key,
                    status: job ? 'success' : 'missing',
                    job,
                    message: '',
                })
            })
            .catch((error) => {
                if (!active) return

                setResult({
                    key,
                    status: 'error',
                    job: null,
                    message: error.message || 'Unable to load this job.',
                })
            })

        return () => {
            active = false
        }
    }, [jobId, retryCount])

    const current = result.key === requestKey
        ? result
        : { status: 'loading', job: null, message: '' }

    const job = current.job
    const returnTo = location.pathname + location.search

    const canRenderApplication =
        JOBS_DATA_MODE === 'live' &&
        typeof renderApplicationAction === 'function'

    return (
        <main className="job-details-page">
            <Link
                to={{
                    pathname: '/jobs',
                    search: location.search,
                }}
            >
                ← Back to search results
            </Link>

            {JOBS_DATA_MODE === 'mock' && (
                <p className="job-details-notice" role="note">
                    Frontend prototype: fictional job.
                    Applications are not submitted.
                </p>
            )}

            <section aria-busy={current.status === 'loading'}>
                {current.status === 'loading' && (
                    <>
                        <h1>Job details</h1>
                        <p role="status">Loading job details…</p>
                    </>
                )}

                {current.status === 'missing' && (
                    <>
                        <h1>Job unavailable</h1>
                        <p role="status">
                            This job could not be found or is no longer
                            available. Return to search results to find
                            another opportunity.
                        </p>
                    </>
                )}

                {current.status === 'error' && (
                    <>
                        <h1>Unable to load job</h1>
                        <p className="job-details-error" role="alert">
                            {current.message}
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                setRetryCount((count) => count + 1)
                            }}
                        >
                            Retry
                        </button>
                    </>
                )}

                {current.status === 'success' && job && (
                    <article className="job-details-content">
                        <h1>{job.title}</h1>
                        <p><strong>{job.company_name}</strong></p>

                        <dl className="job-details-summary">
                            <div>
                                <dt>Location</dt>
                                <dd>{job.location}</dd>
                            </div>
                            <div>
                                <dt>Category</dt>
                                <dd>{job.category}</dd>
                            </div>
                            <div>
                                <dt>Salary</dt>
                                <dd>{formatJobSalary(job)}</dd>
                            </div>
                        </dl>

                        <h2>About the company</h2>
                        <p className="job-description-text">
                            {job.company_description ||
                                'Company description not provided.'}
                        </p>

                        <h2>Job description</h2>
                        <p className="job-description-text">
                            {job.description ||
                                'Job description not provided.'}
                        </p>

                        <h2>Required skills</h2>
                        {job.required_skills?.length ? (
                            <ul>
                                {job.required_skills.map((skill) => (
                                    <li key={skill}>{skill}</li>
                                ))}
                            </ul>
                        ) : (
                            <p>Required skills not provided.</p>
                        )}

                        <section aria-labelledby="job-apply-heading">
                            <h2 id="job-apply-heading">
                                Apply for this job
                            </h2>

                            {canRenderApplication ? (
                                renderApplicationAction({
                                    job,
                                    returnTo,
                                })
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        disabled
                                        aria-describedby="job-apply-help"
                                    >
                                        Apply — unavailable
                                    </button>

                                    <p id="job-apply-help">
                                        Application submission is not
                                        connected in this prototype.
                                        No application will be created.
                                    </p>

                                    {!window.localStorage.getItem('token') && (
                                        <p>
                                            <Link
                                                to="/login"
                                                state={{ returnTo }}
                                            >
                                                Sign in
                                            </Link>
                                            {' '}and return to this job.
                                            Submission will still be
                                            unavailable in mock mode.
                                        </p>
                                    )}
                                </>
                            )}
                        </section>
                    </article>
                )}
            </section>
        </main>
    )
}

export default JobDetails