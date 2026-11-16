import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Alert, Card, CompanyLogo } from '../../components/common'
import { listMyApplications } from '../../services/applicationApi.js'
import {
    createJobSearchParams,
    formatJobSalary,
    readJobFilters,
    validateJobFilters,
} from '../../services/jobApi.js'
import { listJobs } from '../../services/jobsApi.js'
import { timeAgo } from '../../services/format.js'
import styles from './JobsPlaceholderPage.module.css'

const FILTER_FIELDS = [
    ['keyword', 'Keywords', 'Title, company, or skill'],
    ['location', 'Location', 'City, state, or Remote'],
    ['category', 'Category', 'Engineering or Design'],
]

const SALARY_FIELDS = [
    ['salaryMin', 'Minimum salary — CAD/year', '80000'],
    ['salaryMax', 'Maximum salary — CAD/year', '120000'],
]

function matchesFilters(job, filters) {
    const keyword = filters.keyword.trim().toLocaleLowerCase()
    const location = filters.location.trim().toLocaleLowerCase()
    const category = filters.category.trim().toLocaleLowerCase()
    const company = job.company_name ?? job.company
    const jobCategory = job.category ?? job.type

    if (
        keyword &&
        ![job.title, company, ...(job.required_skills || [])]
            .some((value) => value?.toLocaleLowerCase().includes(keyword))
    ) {
        return false
    }

    if (location && !job.location?.toLocaleLowerCase().includes(location)) {
        return false
    }

    if (
        category &&
        String(jobCategory).toLocaleLowerCase() !== category
    ) {
        return false
    }

    const minimumSalary = job.min_salary ?? job.salary_min
    const maximumSalary = job.max_salary ?? job.salary_max
    if (
        filters.salaryMin &&
        maximumSalary != null &&
        maximumSalary < Number(filters.salaryMin)
    ) {
        return false
    }

    return !(filters.salaryMax &&
        minimumSalary != null &&
        minimumSalary > Number(filters.salaryMax));


}

function SearchForm({ query, onSearch, onClear }) {
    const [draft, setDraft] = useState(() => readJobFilters(query))
    const [filterErrors, setFilterErrors] = useState(
        () => validateJobFilters(readJobFilters(query)),
    )

    function handleSearch(event) {
        event.preventDefault()
        const normalized = readJobFilters(createJobSearchParams(draft))
        const errors = validateJobFilters(normalized)
        setFilterErrors(errors)

        if (Object.keys(errors).length) {
            event.currentTarget.elements
                .namedItem(Object.keys(errors)[0])
                ?.focus()
            return
        }

        onSearch(normalized)
    }

    function handleClear() {
        setDraft(readJobFilters())
        setFilterErrors({})
        onClear()
    }

    function renderField([name, label, placeholder]) {
        return (
            <div className={styles.filterField} key={name}>
                <label htmlFor={`jobs-${name}`}>{label}</label>
                <input
                    id={`jobs-${name}`}
                    name={name}
                    type="text"
                    inputMode={name.startsWith('salary') ? 'decimal' : undefined}
                    value={draft[name]}
                    placeholder={placeholder}
                    aria-invalid={Boolean(filterErrors[name])}
                    aria-describedby={filterErrors[name] ? `jobs-${name}-error` : undefined}
                    onChange={(event) => {
                        const nextDraft = { ...draft, [name]: event.target.value }
                        setDraft(nextDraft)
                        setFilterErrors(validateJobFilters(
                            readJobFilters(createJobSearchParams(nextDraft)),
                        ))
                    }}
                />
                {filterErrors[name] && (
                    <p id={`jobs-${name}-error`} className={styles.fieldError} role="alert">
                        {filterErrors[name]}
                    </p>
                )}
            </div>
        )
    }

    return (
        <form className={styles.searchForm} onSubmit={handleSearch} noValidate>
            <div className={styles.filterGrid}>
                {FILTER_FIELDS.map(renderField)}
            </div>
            <div className={styles.salarySearchRow}>
                {SALARY_FIELDS.map(renderField)}
                <div className={styles.searchActions}>
                    <button type="submit">Search</button>
                    <button type="button" className={styles.clearButton} onClick={handleClear}>
                        Clear All
                    </button>
                </div>
            </div>
            <p className={styles.filterHint}>
                Filters combine with AND. Location contains your text; category matches exactly,
                ignoring case. Salary ranges overlap in CAD/year.
            </p>
        </form>
    )
}

// Main job search page with filters, application status, and apply links.
export default function JobsPlaceholderPage() {
    const [searchParams, setSearchParams] = useSearchParams()
    const query = searchParams.toString()
    const filters = readJobFilters(query)
    const [retryCount, setRetryCount] = useState(0)
    const [result, setResult] = useState({
        status: 'loading',
        jobs: [],
        appliedIds: new Set(),
        message: '',
    })

    useEffect(() => {
        let active = true

        Promise.all([listJobs(), listMyApplications()])
            .then(([jobs, applications]) => {
                if (!active) return
                setResult({
                    status: 'success',
                    jobs,
                    appliedIds: new Set(applications.map((application) => String(application.job_id))),
                    message: '',
                })
            })
            .catch((error) => {
                if (!active) return
                setResult({
                    status: 'error',
                    jobs: [],
                    appliedIds: new Set(),
                    message: error.message || 'Unable to load jobs.',
                })
            })

        return () => {
            active = false
        }
    }, [retryCount])

    const filteredJobs = result.jobs.filter((job) => matchesFilters(job, filters))

    function search(nextFilters) {
        setSearchParams(createJobSearchParams(nextFilters))
    }

    function clear() {
        setSearchParams({})
        if (!query) setRetryCount((count) => count + 1)
    }

    const detailSearch = query ? `?${query}` : ''

    return (
        <div className={styles.wrap}>
            <h1 className={styles.h1}>Find jobs</h1>
            <SearchForm key={query} query={query} onSearch={search} onClear={clear} />

            {result.status === 'loading' && <p role="status">Loading jobs…</p>}
            {result.status === 'error' && (
                <Alert tone="error">
                    {result.message}{' '}
                    <button type="button" onClick={() => setRetryCount((count) => count + 1)}>
                        Retry
                    </button>
                </Alert>
            )}

            {result.status === 'success' && (
                <Card className={styles.listCard}>
                    <p className={styles.resultCount} role="status">
                        {filteredJobs.length
                            ? `${filteredJobs.length} job(s) found.`
                            : result.jobs.length
                                ? 'No jobs match your search.'
                                : 'No jobs are available.'}
                    </p>
                    <ul className={styles.list}>
                        {filteredJobs.map((job) => {
                            const company = job.company_name ?? job.company
                            const category = job.category ?? job.type
                            const applied = result.appliedIds.has(String(job.id))
                            return (
                                <li key={job.id} className={styles.job}>
                                    <CompanyLogo name={company} />
                                    <div className={styles.info}>
                                        <h2>
                                            <Link
                                                to={{ pathname: `/jobs/${encodeURIComponent(job.id)}`, search: detailSearch }}
                                                className={styles.titleLink}
                                            >
                                                {job.title}
                                            </Link>
                                        </h2>
                                        <p>{company}</p>
                                        <p className={styles.muted}>
                                            {[job.location, category, job.salary || formatJobSalary(job)]
                                                .filter(Boolean).join(' · ')}
                                        </p>
                                        {job.posted_at && (
                                            <p className={styles.muted}>Posted {timeAgo(job.posted_at)}</p>
                                        )}
                                        {job.description && (
                                            <p className={styles.description}>{job.description}</p>
                                        )}
                                        {job.required_skills?.length > 0 && (
                                            <ul className={styles.skills} aria-label="Required skills">
                                                {job.required_skills.map((skill) => (
                                                    <li key={skill}>{skill}</li>
                                                ))}
                                            </ul>
                                        )}
                                        <Link
                                            to={{ pathname: `/jobs/${encodeURIComponent(job.id)}`, search: detailSearch }}
                                            className={styles.detailsLink}
                                        >
                                            View job details
                                        </Link>
                                    </div>
                                    {applied ? (
                                        <Link to="/applications" className={styles.applied}>
                                            ✓ Applied
                                        </Link>
                                    ) : (
                                        <Link to={`/jobs/${encodeURIComponent(job.id)}/apply`} className={styles.apply}>
                                            Apply
                                        </Link>
                                    )}
                                </li>
                            )
                        })}
                    </ul>
                </Card>
            )}
        </div>
    )
}
