import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import JobCard from './JobCard.jsx'
import {
    createJobSearchParams,
    getJobs,
    JOBS_DATA_MODE,
    readJobFilters,
    validateJobFilters,
} from '../services/jobApi.js'
import './JobListings.css'

const FIELDS = [
    ['keyword', 'Keywords', 'Title, company, or skill'],
    ['location', 'Location', 'City, state, or Remote'],
    ['category', 'Category', 'Engineering or Design'],
    ['salaryMin', 'Minimum salary — CAD/year', '80000'],
    ['salaryMax', 'Maximum salary — CAD/year', '120000'],
]

function SearchForm({ query, onSearch, onClear }) {
    const [draft, setDraft] = useState(
        () => readJobFilters(query),
    )
    const [errors, setErrors] = useState(
        () => validateJobFilters(readJobFilters(query)),
    )

    function handleSubmit(event) {
        event.preventDefault()

        const normalized = readJobFilters(
            createJobSearchParams(draft).toString(),
        )

        const nextErrors = validateJobFilters(normalized)
        setErrors(nextErrors)

        if (Object.keys(nextErrors).length) {
            event.currentTarget.elements
                .namedItem(Object.keys(nextErrors)[0])
                ?.focus()
            return
        }

        onSearch(normalized)
    }

    function handleClear() {
        setDraft(readJobFilters())
        setErrors({})
        onClear()
    }

    return (
        <form
            className="job-search-form"
            onSubmit={handleSubmit}
            noValidate
        >
            <div className="job-filter-grid">
                {FIELDS.map(([name, label, placeholder]) => (
                    <div className="job-filter-field" key={name}>
                        <label htmlFor={`jobs-${name}`}>
                            {label}
                        </label>

                        <input
                            id={`jobs-${name}`}
                            name={name}
                            type="text"
                            inputMode={
                                name.startsWith('salary')
                                    ? 'decimal'
                                    : undefined
                            }
                            value={draft[name]}
                            placeholder={placeholder}
                            aria-invalid={Boolean(errors[name])}
                            aria-describedby={
                                errors[name]
                                    ? `jobs-${name}-error`
                                    : undefined
                            }
                            onChange={(event) => {
                                const nextDraft = {
                                    ...draft,
                                    [name]: event.target.value,
                                }
                                setDraft(nextDraft)
                                setErrors(validateJobFilters(
                                    readJobFilters(
                                        createJobSearchParams(nextDraft),
                                    ),
                                ))
                            }}
                        />

                        {errors[name] && (
                            <p
                                id={`jobs-${name}-error`}
                                className="job-field-error"
                                role="alert"
                            >
                                {errors[name]}
                            </p>
                        )}
                    </div>
                ))}
            </div>

            <p>
                Prototype: filters combine with AND. Location
                contains your text; category matches exactly,
                ignoring case. Salary ranges overlap in CAD/year.
            </p>

            <div className="job-search-actions">
                <button type="submit">Search jobs</button>
                <button
                    type="button"
                    className="job-secondary"
                    onClick={handleClear}
                >
                    Clear All
                </button>
            </div>
        </form>
    )
}

function JobListings() {
    const [searchParams, setSearchParams] = useSearchParams()
    const query = searchParams.toString()
    const [retryCount, setRetryCount] = useState(0)

    const [result, setResult] = useState({
        key: '',
        status: 'loading',
        jobs: [],
        message: '',
    })

    const requestKey = JSON.stringify([query, retryCount])

    useEffect(() => {
        let active = true
        const key = JSON.stringify([query, retryCount])
        const filters = readJobFilters(query)
        const errors = validateJobFilters(filters)

        if (!Object.keys(errors).length) {
            getJobs(filters)
                .then((jobs) => {
                    if (!active) return

                    setResult({
                        key,
                        status: 'success',
                        jobs,
                        message: '',
                    })
                })
                .catch((error) => {
                    if (!active) return

                    setResult({
                        key,
                        status: 'error',
                        jobs: [],
                        message: error.message || 'Unable to load jobs.',
                    })
                })
        }

        return () => {
            active = false
        }
    }, [query, retryCount])

    // Never display results belonging to the previous search.
    const current = result.key === requestKey
        ? result
        : Object.keys(validateJobFilters(readJobFilters(query))).length
            ? {
                status: 'invalid',
                jobs: [],
                message: Object.values(
                    validateJobFilters(readJobFilters(query)),
                ).join(' '),
            }
            : { status: 'loading', jobs: [], message: '' }

    function search(filters) {
        const nextQuery = createJobSearchParams(filters).toString()

        if (nextQuery === query) {
            setRetryCount((count) => count + 1)
        } else {
            setSearchParams(nextQuery)
        }
    }

    function clear() {
        if (query) {
            setSearchParams({})
        } else {
            setRetryCount((count) => count + 1)
        }
    }

    return (
        <main className="job-listings-page">
            <Link to="/">← Home</Link>
            <h1>Find jobs</h1>

            <p className="job-prototype-notice" role="note">
                {JOBS_DATA_MODE === 'mock'
                    ? 'Frontend prototype: fictional jobs and companies. No applications are submitted.'
                    : 'Jobs integration is not configured. Live functionality is unavailable.'}
            </p>

            <SearchForm
                key={query}
                query={query}
                onSearch={search}
                onClear={clear}
            />

            <section
                className="job-results"
                aria-labelledby="job-results-heading"
                aria-busy={current.status === 'loading'}
            >
                <h2 id="job-results-heading">Search results</h2>

                {current.status === 'loading' && (
                    <p role="status">Loading jobs…</p>
                )}

                {['invalid', 'error'].includes(current.status) && (
                    <div className="job-error-box">
                        <p role="alert">{current.message}</p>

                        {current.status === 'error' ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setRetryCount((count) => count + 1)
                                }}
                            >
                                Retry
                            </button>
                        ) : (
                            <p>Correct the filters or select Clear All.</p>
                        )}
                    </div>
                )}

                {current.status === 'success' && (
                    <>
                        <p role="status">
                            {current.jobs.length
                                ? `${current.jobs.length} job(s) found.`
                                : 'No jobs match your filters. Change or clear your filters.'}
                        </p>

                        <div className="job-card-grid">
                            {current.jobs.map((job) => (
                                <JobCard
                                    key={job.id}
                                    job={job}
                                    search={query ? `?${query}` : ''}
                                />
                            ))}
                        </div>
                    </>
                )}
            </section>
        </main>
    )
}

export default JobListings