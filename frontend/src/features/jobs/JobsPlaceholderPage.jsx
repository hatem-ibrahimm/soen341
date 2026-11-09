import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Card, CompanyLogo } from '../../components/common'
import { listMyApplications } from '../../services/applicationApi.js'
import {
    createJobSearchParams,
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
    ['salaryMin', 'Minimum salary — CAD/year', '80000'],
    ['salaryMax', 'Maximum salary — CAD/year', '120000'],
]

function matchesFilters(job, filters) {
    const keyword = filters.keyword.trim().toLocaleLowerCase()
    const location = filters.location.trim().toLocaleLowerCase()
    const category = filters.category.trim().toLocaleLowerCase()

    if (
        keyword &&
        ![job.title, job.company, ...(job.required_skills || [])]
            .some((value) => value?.toLocaleLowerCase().includes(keyword))
    ) {
        return false
    }

    if (location && !job.location?.toLocaleLowerCase().includes(location)) {
        return false
    }

    if (
        category &&
        String(job.category ?? job.type).toLocaleLowerCase() !== category
    ) {
        return false
    }

    if (
        filters.salaryMin &&
        job.max_salary != null &&
        job.max_salary < Number(filters.salaryMin)
    ) {
        return false
    }

    if (
        filters.salaryMax &&
        job.min_salary != null &&
        job.min_salary > Number(filters.salaryMax)
    ) {
        return false
    }

    return true
}

// TEMPORARY — stand-in for the Job Search & Listing feature (teammate's work).
// Replace this route's element with the real job listing page when it is merged.
// The only thing it needs to do for us: link "Apply" to /jobs/:jobId/apply
export default function JobsPlaceholderPage() {
    const [jobs, setJobs] = useState([])
    const [appliedIds, setAppliedIds] = useState(new Set())
    const [error, setError] = useState('')
    const [draft, setDraft] = useState(() => readJobFilters())
    const [filters, setFilters] = useState(() => readJobFilters())
    const [filterErrors, setFilterErrors] = useState({})

    useEffect(() => {
        Promise.all([listJobs(), listMyApplications()])
            .then(([j, apps]) => {
                setJobs(j)
                setAppliedIds(new Set(apps.map((a) => a.job_id)))
            })
            .catch((e) => setError(e.message))
    }, [])

    const filteredJobs = jobs.filter((job) =>
        matchesFilters(job, filters),
    )

    function handleSearch(event) {
        event.preventDefault()
        const normalized = readJobFilters(createJobSearchParams(draft))
        const nextErrors = validateJobFilters(normalized)
        setFilterErrors(nextErrors)

        if (Object.keys(nextErrors).length) {
            event.currentTarget.elements
                .namedItem(Object.keys(nextErrors)[0])
                ?.focus()
            return
        }

        setFilters(normalized)
    }

    function handleClear() {
        const emptyFilters = readJobFilters()
        setDraft(emptyFilters)
        setFilters(emptyFilters)
        setFilterErrors({})
    }

    return (
        <div className={styles.wrap}>
            <div className={styles.banner}>
                <strong>Placeholder job list.</strong> Apply links to <code>/jobs/:jobId/apply</code>.
            </div>
            <h1 className={styles.h1}>Recommended jobs</h1>
            {error && <Alert tone="error">{error}</Alert>}
            <form className={styles.searchForm} onSubmit={handleSearch} noValidate>
                <div className={styles.filterGrid}>
                    {FILTER_FIELDS.map(([name, label, placeholder]) => (
                        <div className={styles.filterField} key={name}>
                            <label htmlFor={`placeholder-jobs-${name}`}>
                                {label}
                            </label>
                            <input
                                id={`placeholder-jobs-${name}`}
                                name={name}
                                type="text"
                                inputMode={name.startsWith('salary') ? 'decimal' : undefined}
                                value={draft[name]}
                                placeholder={placeholder}
                                aria-invalid={Boolean(filterErrors[name])}
                                aria-describedby={filterErrors[name]
                                    ? `placeholder-jobs-${name}-error`
                                    : undefined}
                                onChange={(event) => {
                                    const nextDraft = {
                                        ...draft,
                                        [name]: event.target.value,
                                    }
                                    setDraft(nextDraft)
                                    setFilterErrors(validateJobFilters(
                                        readJobFilters(createJobSearchParams(nextDraft)),
                                    ))
                                }}
                            />
                            {filterErrors[name] && (
                                <p
                                    id={`placeholder-jobs-${name}-error`}
                                    className={styles.fieldError}
                                    role="alert"
                                >
                                    {filterErrors[name]}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
                <p className={styles.filterHint}>
                    Filters combine with AND. Location contains your text; category matches exactly, ignoring case. Salary ranges overlap in CAD/year.
                </p>
                <div className={styles.searchActions}>
                    <button type="submit">Search jobs</button>
                    <button type="button" className={styles.clearButton} onClick={handleClear}>
                        Clear All
                    </button>
                </div>
            </form>
            <Card className={styles.listCard}>
                <ul className={styles.list}>
                    {filteredJobs.map((job) => (
                        <li key={job.id} className={styles.job}>
                            <CompanyLogo name={job.company} />
                            <div className={styles.info}>
                                <h2><Link to={`/jobs/${job.id}`} className={styles.titleLink}>{job.title}</Link></h2>
                                <p>{job.company}</p>
                                <p className={styles.muted}>
                                    {job.location} · {job.type} · {job.salary}
                                </p>
                                <p className={styles.muted}>Posted {timeAgo(job.posted_at)}</p>
                            </div>
                            {appliedIds.has(job.id) ? (
                                <Link to="/applications" className={styles.applied}>
                                    ✓ Applied
                                </Link>
                            ) : (
                                <Link to={`/jobs/${job.id}/apply`} className={styles.apply}>
                                    Apply
                                </Link>
                            )}
                        </li>
                    ))}
                </ul>
                {!error && filteredJobs.length === 0 && (
                    <p className={styles.emptyState} role="status">
                        {jobs.length === 0
                            ? 'No jobs are available.'
                            : 'No jobs match your search.'}
                    </p>
                )}
            </Card>
        </div>
    )
}
