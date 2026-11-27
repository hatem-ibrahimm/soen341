import { useEffect, useMemo, useState } from 'react'
import {
    createJobListing,
    deleteJobListing,
    listRecruiterJobs,
    updateJobListing,
} from '../services/recruiterApi.js'
import RecruiterApplicants from './RecruiterApplicants.jsx'
import { getCompanyName } from '../services/session.js'
import { formatJobSalary } from '../services/jobApi.js'
import './RecruiterDashboard.css'

const EMPTY_FORM = {
    title: '',
    company_name: '',
    location: '',
    category: '',
    description: '',
    required_skills: [],
    min_salary: '',
    max_salary: '',
    application_deadline: '',
    status: 'published',
}

function emptyForm() {
    return { ...EMPTY_FORM, company_name: getCompanyName() }
}

function formFromJob(job) {
    return {
        title: job.title ?? '',
        company_name: job.company_name ?? job.company ?? '',
        location: job.location ?? '',
        category: job.category ?? '',
        description: job.description ?? '',
        required_skills: job.required_skills ?? [],
        min_salary: job.min_salary ?? '',
        max_salary: job.max_salary ?? '',
        application_deadline: job.application_deadline ?? '',
        status: job.status ?? 'draft',
    }
}

function RecruiterDashboard() {
    const [jobs, setJobs] = useState([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')
    const [retryCount, setRetryCount] = useState(0)
    const [editingJob, setEditingJob] = useState(null)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [form, setForm] = useState(emptyForm)
    const [skillDraft, setSkillDraft] = useState('')
    const [formError, setFormError] = useState('')
    const [notice, setNotice] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [closingJobId, setClosingJobId] = useState(null)
    const [postingsQuery, setPostingsQuery] = useState('')
    const [isPostingsOpen, setIsPostingsOpen] = useState(true)
    const [isArchivedOpen, setIsArchivedOpen] = useState(true)

    useEffect(() => {
        let active = true

        listRecruiterJobs()
            .then((listings) => {
                if (active) setJobs(listings)
            })
            .catch((error) => {
                if (active) {
                    setLoadError(error.message || 'Unable to load your job postings.')
                }
            })
            .finally(() => {
                if (active) setLoading(false)
            })

        return () => {
            active = false
        }
    }, [retryCount])

    function retryLoad() {
        setLoading(true)
        setLoadError('')
        setRetryCount((count) => count + 1)
    }

    function handleChange(event) {
        const { name, value } = event.target
        setForm((current) => ({ ...current, [name]: value }))
        setFormError('')
        setNotice('')
    }

    function addSkill(event) {
        event?.preventDefault()
        const skill = skillDraft.trim()

        if (!skill) return
        if (skill.length > 80) {
            setFormError('Each required skill must be 80 characters or fewer.')
            return
        }
        if (form.required_skills.length >= 30) {
            setFormError('Add no more than 30 required skills.')
            return
        }
        if (
            form.required_skills.some(
                (existing) => existing.toLocaleLowerCase() === skill.toLocaleLowerCase(),
            )
        ) {
            setFormError('That required skill has already been added.')
            return
        }

        setForm((current) => ({
            ...current,
            required_skills: [...current.required_skills, skill],
        }))
        setSkillDraft('')
        setFormError('')
    }

    function removeSkill(skillToRemove) {
        setForm((current) => ({
            ...current,
            required_skills: current.required_skills.filter(
                (skill) => skill !== skillToRemove,
            ),
        }))
    }

    function validateForm() {
        const requiredTextFields = [
            ['title', 'Job title', 160],
            ['company_name', 'Company name', 160],
            ['location', 'Location', 200],
            ['category', 'Category', 100],
            ['description', 'Description', 10000],
        ]

        for (const [field, label, maxLength] of requiredTextFields) {
            const value = form[field].trim()
            if (!value) return `${label} is required.`
            if (value.length > maxLength) {
                return `${label} must be ${maxLength} characters or fewer.`
            }
        }

        for (const [field, label] of [
            ['min_salary', 'Minimum salary'],
            ['max_salary', 'Maximum salary'],
        ]) {
            if (form[field] === '') continue
            const amount = Number(form[field])
            if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000) {
                return `${label} must be between 0 and 1,000,000,000.`
            }
            if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(form[field])) {
                return `${label} may contain at most two decimal places.`
            }
        }

        if (
            form.min_salary !== '' &&
            form.max_salary !== '' &&
            Number(form.min_salary) > Number(form.max_salary)
        ) {
            return 'Minimum salary cannot exceed maximum salary.'
        }

        if (form.required_skills.length > 30) {
            return 'Add no more than 30 required skills.'
        }

        return ''
    }

    async function handleSubmit(event) {
        event.preventDefault()
        if (isSaving) return

        const validationError = validateForm()
        if (validationError) {
            setFormError(validationError)
            return
        }

        const listing = {
            ...form,
            title: form.title.trim(),
            company_name: form.company_name.trim(),
            location: form.location.trim(),
            category: form.category.trim(),
            description: form.description.trim(),
            required_skills: form.required_skills,
            min_salary: form.min_salary === '' ? null : Number(form.min_salary),
            max_salary: form.max_salary === '' ? null : Number(form.max_salary),
            application_deadline: form.application_deadline || null,
        }

        setFormError('')
        setNotice('')
        setIsSaving(true)

        try {
            const savedJob = editingJob
                ? await updateJobListing(editingJob.id, listing)
                : await createJobListing(listing)
            setJobs((current) => {
                const withoutSaved = current.filter(
                    (job) => String(job.id) !== String(savedJob.id),
                )
                return [savedJob, ...withoutSaved]
            })
            setNotice(
                editingJob
                    ? 'Your job posting has been updated.'
                    : listing.status === 'published'
                        ? 'Your job posting is published and visible in job search.'
                        : 'Your draft has been saved. Publish it when it is ready.',
            )
            setEditingJob(null)
            setForm(emptyForm())
            setSkillDraft('')
            setIsFormOpen(false)
        } catch (error) {
            setFormError(error.message || 'Unable to save the job posting.')
        } finally {
            setIsSaving(false)
        }
    }

    function startCreate() {
        setEditingJob(null)
        setForm(emptyForm())
        setSkillDraft('')
        setFormError('')
        setNotice('')
        setIsFormOpen(true)
    }

    function startEdit(job) {
        setEditingJob(job)
        setForm(formFromJob(job))
        setSkillDraft('')
        setFormError('')
        setNotice('')
        setIsFormOpen(true)
    }

    function reuseArchivedJob(job) {
        setEditingJob(null)
        setForm({
            ...formFromJob(job),
            status: 'draft',
        })
        setSkillDraft('')
        setFormError('')
        setNotice('')
        setIsFormOpen(true)
        window.requestAnimationFrame(() => {
            document.getElementById('posting-form-heading')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            })
        })
    }

    function clearJobForm() {
        setEditingJob(null)
        setForm(emptyForm())
        setSkillDraft('')
        setFormError('')
        setNotice('')
    }

    async function deleteArchivedJob(job) {
        if (!window.confirm(
            `Delete "${job.title}" permanently? This will also delete all applications and data associated with it.`,
        )) {
            return
        }

        setClosingJobId(job.id)
        setLoadError('')
        setNotice('')
        try {
            await deleteJobListing(job.id)
            setJobs((current) =>
                current.filter((item) => String(item.id) !== String(job.id)),
            )
            setNotice('The archived job listing and its associated data have been deleted.')
        } catch (error) {
            setLoadError(error.message || 'Unable to delete the archived job listing.')
        } finally {
            setClosingJobId(null)
        }
    }

    async function closeListing(job) {
        if (
            !window.confirm(
                `Close "${job.title}"? It will stop accepting applications. Existing applications will be kept.`,
            )
        ) {
            return
        }

        setClosingJobId(job.id)
        setLoadError('')
        setNotice('')
        try {
            const updated = await updateJobListing(job.id, { status: 'closed' })
            setJobs((current) =>
                current.map((item) =>
                    String(item.id) === String(updated.id) ? updated : item,
                ),
            )
            if (String(editingJob?.id) === String(updated.id)) {
                setEditingJob(updated)
                setForm(formFromJob(updated))
            }
            setNotice('Applications are closed for this job posting. Existing applications remain unchanged.')
        } catch (error) {
            setLoadError(error.message || 'Unable to close the job posting.')
        } finally {
            setClosingJobId(null)
        }
    }

    async function archiveListing(job) {
        if (!window.confirm(`Archive "${job.title}"? It will be hidden from job search.`)) {
            return
        }

        setClosingJobId(job.id)
        setLoadError('')
        setNotice('')
        try {
            const updated = await updateJobListing(job.id, { status: 'archived' })
            setJobs((current) =>
                current.map((item) =>
                    String(item.id) === String(updated.id) ? updated : item,
                ),
            )
            setNotice('The job posting has been archived.')
        } catch (error) {
            setLoadError(error.message || 'Unable to archive the job posting.')
        } finally {
            setClosingJobId(null)
        }
    }

    const isEditing = Boolean(editingJob)
    const visibleJobs = useMemo(() => {
        const query = postingsQuery.trim().toLocaleLowerCase()
        const activeJobs = jobs.filter((job) => (job.status ?? 'published') !== 'archived')
        if (!query) return activeJobs

        return activeJobs.filter((job) =>
            [job.title, job.company_name ?? job.company, job.location, job.category]
                .some((value) => value?.toLocaleLowerCase().includes(query)),
        )
    }, [jobs, postingsQuery])
    const activeJobCount = useMemo(
        () => jobs.filter((job) => (job.status ?? 'published') !== 'archived').length,
        [jobs],
    )
    const archivedJobs = useMemo(
        () => jobs.filter((job) => job.status === 'archived'),
        [jobs],
    )

    return (
        <div className="recruiter-dashboard">
            <header className="recruiter-heading">
                <div>
                    <p className="recruiter-eyebrow">Recruiter workspace</p>
                    <h1>Recruiter dashboard</h1>
                    <p className="recruiter-intro">
                        Create and manage your job postings.
                    </p>
                </div>
                <div className="recruiter-count">
                    <strong>{activeJobCount}</strong>
                    <span>Your postings</span>
                </div>
            </header>

            {notice && <p className="recruiter-notice" role="status">{notice}</p>}
            {loadError && (
                <div className="recruiter-error-box">
                    <p role="alert">{loadError}</p>
                    <button
                        type="button"
                        onClick={retryLoad}
                    >
                        Retry
                    </button>
                </div>
            )}

            <div className="recruiter-layout">
                <section className="recruiter-panel" aria-labelledby="posting-form-heading">
                    <div className={`recruiter-panel-heading${isFormOpen ? ' recruiter-panel-heading-open' : ''}`}>
                        <button
                            type="button"
                            id="posting-form-heading"
                            className="recruiter-form-toggle"
                            aria-expanded={isFormOpen}
                            aria-controls="job-posting-form"
                            onClick={() => setIsFormOpen((open) => !open)}
                        >
                            <span>
                                <strong>{isEditing ? 'Edit job posting' : 'Create a job listing'}</strong>
                                {isFormOpen && (
                                    <small>
                                        {isEditing
                                            ? 'Update your role details and publication status.'
                                            : 'Draft postings stay private. Published postings appear in job search.'}
                                    </small>
                                )}
                            </span>
                            <span className="recruiter-form-toggle-icon" aria-hidden="true">
                                {isFormOpen ? '−' : '+'}
                            </span>
                        </button>
                        {isEditing && (
                            <button
                                type="button"
                                className="recruiter-text-button"
                                onClick={startCreate}
                            >
                                Create new
                            </button>
                        )}
                    </div>

                    <form
                        id="job-posting-form"
                        className="recruiter-form"
                        onSubmit={handleSubmit}
                        noValidate
                        hidden={!isFormOpen}
                    >
                        <div className="recruiter-form-grid">
                            <label className="recruiter-field recruiter-field-full">
                                Job title
                                <input
                                    name="title"
                                    value={form.title}
                                    onChange={handleChange}
                                    maxLength={160}
                                    required
                                />
                            </label>

                            <label className="recruiter-field">
                                Company
                                <input
                                    name="company_name"
                                    value={form.company_name}
                                    onChange={handleChange}
                                    maxLength={160}
                                    required
                                />
                            </label>

                            <label className="recruiter-field">
                                Location
                                <input
                                    name="location"
                                    value={form.location}
                                    onChange={handleChange}
                                    maxLength={200}
                                    required
                                />
                            </label>

                            <label className="recruiter-field">
                                Category
                                <input
                                    name="category"
                                    value={form.category}
                                    onChange={handleChange}
                                    maxLength={100}
                                    required
                                />
                            </label>

                            <label className="recruiter-field">
                                Publication status
                                <select
                                    name="status"
                                    value={form.status}
                                    onChange={handleChange}
                                    disabled={form.status === 'closed' || form.status === 'archived'}
                                >
                                    <option value="draft">Draft — private</option>
                                    <option value="published">Published — visible in search</option>
                                    {form.status === 'closed' && (
                                        <option value="closed">Closed</option>
                                    )}
                                    {form.status === 'archived' && (
                                        <option value="archived">Archived</option>
                                    )}
                                </select>
                            </label>

                            <label className="recruiter-field recruiter-field-full">
                                Job description
                                <textarea
                                    name="description"
                                    value={form.description}
                                    onChange={handleChange}
                                    rows="5"
                                    maxLength={10000}
                                    required
                                />
                            </label>

                            <fieldset className="recruiter-field recruiter-field-full recruiter-skills">
                                <legend>Required skills <span>(optional, up to 30)</span></legend>
                                <div className="recruiter-skill-entry">
                                    <input
                                        aria-label="Add a required skill"
                                        value={skillDraft}
                                        onChange={(event) => {
                                            setSkillDraft(event.target.value)
                                            setFormError('')
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') addSkill(event)
                                        }}
                                        maxLength={80}
                                        placeholder="e.g. React or Python"
                                    />
                                    <button
                                        type="button"
                                        className="recruiter-secondary-button"
                                        onClick={addSkill}
                                    >
                                        Add skill
                                    </button>
                                </div>
                                {form.required_skills.length > 0 && (
                                    <ul className="recruiter-skill-list">
                                        {form.required_skills.map((skill) => (
                                            <li key={skill}>
                                                {skill}
                                                <button
                                                    type="button"
                                                    aria-label={`Remove ${skill}`}
                                                    onClick={() => removeSkill(skill)}
                                                >
                                                    ×
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </fieldset>

                            <label className="recruiter-field">
                                Minimum salary (CAD/year)
                                <input
                                    name="min_salary"
                                    type="number"
                                    min="0"
                                    max="1000000000"
                                    step="0.01"
                                    inputMode="decimal"
                                    value={form.min_salary}
                                    onChange={handleChange}
                                    placeholder="Optional"
                                />
                            </label>

                            <label className="recruiter-field">
                                Maximum salary (CAD/year)
                                <input
                                    name="max_salary"
                                    type="number"
                                    min="0"
                                    max="1000000000"
                                    step="0.01"
                                    inputMode="decimal"
                                    value={form.max_salary}
                                    onChange={handleChange}
                                    placeholder="Optional"
                                />
                            </label>

                            <label className="recruiter-field">
                                Application deadline
                                <input
                                    name="application_deadline"
                                    type="date"
                                    value={form.application_deadline}
                                    onChange={handleChange}
                                />
                            </label>
                        </div>

                        {formError && <p className="recruiter-error" role="alert">{formError}</p>}

                        <div className="recruiter-form-actions">
                            {isEditing && (
                                <button
                                    type="button"
                                    className="recruiter-secondary-button"
                                    onClick={startCreate}
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                type="button"
                                className="recruiter-secondary-button"
                                onClick={clearJobForm}
                            >
                                Clear All
                            </button>
                            <button type="submit" disabled={isSaving}>
                                {isSaving
                                    ? 'Saving…'
                                    : isEditing
                                        ? 'Save changes'
                                        : form.status === 'published'
                                            ? 'Publish job posting'
                                            : 'Save draft'}
                            </button>
                        </div>
                    </form>
                </section>

                <section className="recruiter-panel recruiter-postings-panel" aria-labelledby="your-postings-heading">
                    <div className={`recruiter-panel-heading${isPostingsOpen ? ' recruiter-panel-heading-open' : ''}`}>
                        <button
                            type="button"
                            id="your-postings-heading"
                            className="recruiter-form-toggle"
                            aria-expanded={isPostingsOpen}
                            aria-controls="active-job-postings"
                            onClick={() => setIsPostingsOpen((open) => !open)}
                        >
                            <span>
                                <strong>Your job postings</strong>
                                {isPostingsOpen && (
                                    <small>Only postings managed by your recruiter account.</small>
                                )}
                            </span>
                            <span className="recruiter-form-toggle-icon" aria-hidden="true">
                                {isPostingsOpen ? '−' : '+'}
                            </span>
                        </button>
                    </div>

                    <div id="active-job-postings" hidden={!isPostingsOpen}>
                        <div className="recruiter-postings-search">
                            <input
                                type="search"
                                placeholder="Search by job title or company"
                                value={postingsQuery}
                                onChange={(event) => setPostingsQuery(event.target.value)}
                                aria-label="Search job postings"
                            />
                        </div>

                        {loading ? (
                            <p className="recruiter-empty" role="status">Loading your postings…</p>
                        ) : activeJobCount ? (
                            <div className="recruiter-postings-scroll">
                                <ul className="recruiter-listings">
                                    {visibleJobs.map((job) => {
                                        const status = job.status ?? 'published'
                                        const isClosing = String(closingJobId) === String(job.id)
                                        return (
                                            <li key={job.id} className="recruiter-listing">
                                                <div className="recruiter-listing-title-row">
                                                    <h3>{job.title}</h3>
                                                    <span className={`recruiter-status recruiter-status-${status}`}>
                                                        {status}
                                                    </span>
                                                </div>
                                                <p>{job.company_name ?? job.company}</p>
                                                <p className="recruiter-listing-meta">
                                                    {job.location} · {job.category}
                                                </p>
                                                {job.salary && (
                                                    <p className="recruiter-listing-meta">{job.salary}</p>
                                                )}
                                                {job.application_deadline && (
                                                    <p className="recruiter-listing-meta">
                                                        Apply by {job.application_deadline}
                                                    </p>
                                                )}
                                                {job.required_skills?.length > 0 && (
                                                    <p className="recruiter-listing-meta">
                                                        Skills: {job.required_skills.join(', ')}
                                                    </p>
                                                )}
                                                <div className="recruiter-listing-actions">
                                                    <button
                                                        type="button"
                                                        className="recruiter-secondary-button"
                                                        onClick={() => startEdit(job)}
                                                    >
                                                        Edit
                                                    </button>
                                                    {status !== 'closed' && (
                                                        <button
                                                            type="button"
                                                            className="recruiter-close-button"
                                                            disabled={isClosing}
                                                            onClick={() => closeListing(job)}
                                                        >
                                                            {isClosing ? 'Closing applications…' : 'Close applications'}
                                                        </button>
                                                    )}
                                                    {status !== 'archived' && (
                                                        <button
                                                            type="button"
                                                            className="recruiter-secondary-button"
                                                            disabled={isClosing}
                                                            onClick={() => archiveListing(job)}
                                                        >
                                                            {isClosing ? 'Archiving…' : 'Archive'}
                                                        </button>
                                                    )}
                                                </div>
                                                <RecruiterApplicants job={job} />
                                            </li>
                                        )
                                    })}
                                    {visibleJobs.length === 0 && (
                                        <li className="recruiter-empty" role="status">
                                            No postings match your search.
                                        </li>
                                    )}
                                </ul>
                            </div>
                        ) : loadError ? null : (
                            <p className="recruiter-empty" role="status">
                                You have no active job postings. Create a draft or publish an opening.
                            </p>
                        )}
                    </div>
                </section>

                {archivedJobs.length > 0 && (
                    <section className="recruiter-panel recruiter-postings-panel" aria-labelledby="archived-listings-heading">
                        <div className={`recruiter-panel-heading${isArchivedOpen ? ' recruiter-panel-heading-open' : ''}`}>
                            <button
                                type="button"
                                id="archived-listings-heading"
                                className="recruiter-form-toggle"
                                aria-expanded={isArchivedOpen}
                                aria-controls="archived-job-postings"
                                onClick={() => setIsArchivedOpen((open) => !open)}
                            >
                                <span>
                                    <strong>Archived listings</strong>
                                    {isArchivedOpen && (
                                        <small>Postings hidden from job search and kept for your records.</small>
                                    )}
                                </span>
                                <span className="recruiter-form-toggle-icon" aria-hidden="true">
                                    {isArchivedOpen ? '−' : '+'}
                                </span>
                            </button>
                        </div>

                        <div id="archived-job-postings" hidden={!isArchivedOpen}>
                            <div className="recruiter-postings-scroll">
                                <ul className="recruiter-listings">
                                    {archivedJobs.map((job) => (
                                        <li key={job.id} className="recruiter-archived-item">
                                            <div className="recruiter-listing-title-row">
                                                <h3>{job.title}</h3>
                                                <span className="recruiter-status recruiter-status-archived">
                                                    Archived
                                                </span>
                                            </div>
                                            <p><strong>{job.company_name ?? job.company}</strong></p>
                                            <dl className="recruiter-listing-summary">
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
                                            {job.application_deadline && (
                                                <p className="recruiter-listing-meta">
                                                    Apply by {job.application_deadline}
                                                </p>
                                            )}
                                            <h4>Required skills</h4>
                                            {job.required_skills?.length > 0 ? (
                                                <ul className="recruiter-listing-skills">
                                                    {job.required_skills.map((skill) => (
                                                        <li key={skill}>{skill}</li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="recruiter-listing-meta">
                                                    Required skills not provided.
                                                </p>
                                            )}
                                            <div className="recruiter-listing-actions">
                                                <button
                                                    type="button"
                                                    className="recruiter-secondary-button"
                                                    onClick={() => reuseArchivedJob(job)}
                                                >
                                                    Reuse
                                                </button>
                                                <button
                                                    type="button"
                                                    className="recruiter-close-button"
                                                    disabled={String(closingJobId) === String(job.id)}
                                                    onClick={() => deleteArchivedJob(job)}
                                                >
                                                    {String(closingJobId) === String(job.id)
                                                        ? 'Deleting…'
                                                        : 'Delete'}
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </section>
                )}
            </div>
        </div>
    )
}

export default RecruiterDashboard
