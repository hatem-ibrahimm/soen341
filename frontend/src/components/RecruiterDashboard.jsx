import { useState } from 'react'
import { createJobListing } from '../services/recruiterApi.js'
import './RecruiterDashboard.css'

const EMPTY_FORM = {
    title: '',
    company_name: '',
    location: '',
    category: '',
    min_salary: '',
    max_salary: '',
    description: '',
}

function RecruiterDashboard() {
    const [form, setForm] = useState(EMPTY_FORM)
    const [listings, setListings] = useState([])
    const [error, setError] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    function handleChange(event) {
        const { name, value } = event.target
        setForm((current) => ({ ...current, [name]: value }))
        setError('')
    }

    async function handleSubmit(event) {
        event.preventDefault()
        if (isSubmitting) return

        const listing = {
            title: form.title.trim(),
            company_name: form.company_name.trim(),
            location: form.location.trim(),
            category: form.category.trim(),
            description: form.description.trim(),
            min_salary: form.min_salary === '' ? null : Number(form.min_salary),
            max_salary: form.max_salary === '' ? null : Number(form.max_salary),
        }

        if (
            !listing.title ||
            !listing.company_name ||
            !listing.location ||
            !listing.category ||
            !listing.description
        ) {
            setError('Complete all required fields before publishing.')
            return
        }

        if (listing.min_salary != null && listing.min_salary < 0) {
            setError('Minimum salary must be a non-negative amount.')
            return
        }
        if (listing.max_salary != null && listing.max_salary < 0) {
            setError('Maximum salary must be a non-negative amount.')
            return
        }
        if (
            listing.min_salary != null &&
            listing.max_salary != null &&
            listing.min_salary > listing.max_salary
        ) {
            setError('Maximum salary must be greater than or equal to minimum salary.')
            return
        }

        setError('')
        setIsSubmitting(true)

        try {
            const created = await createJobListing(listing)
            setListings((current) => [created, ...current])
            setForm(EMPTY_FORM)
        } catch (requestError) {
            setError(requestError.message || 'Unable to create the job listing.')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="recruiter-dashboard">
            <header className="recruiter-heading">
                <div>
                    <p className="recruiter-eyebrow">Recruiter workspace</p>
                    <h1>Recruiter dashboard</h1>
                    <p className="recruiter-intro">
                        Create a job listing and connect with qualified candidates.
                    </p>
                </div>
                <div className="recruiter-count" aria-label={`${listings.length} listings created this session`}>
                    <strong>{listings.length}</strong>
                    <span>Created this session</span>
                </div>
            </header>

            <div className="recruiter-layout">
                <section className="recruiter-panel" aria-labelledby="create-listing-heading">
                    <div className="recruiter-panel-heading">
                        <div>
                            <h2 id="create-listing-heading">Create a job listing</h2>
                            <p>Share the role details candidates need to apply.</p>
                        </div>
                    </div>

                    <form className="recruiter-form" onSubmit={handleSubmit}>
                        <div className="recruiter-form-grid">
                            <label className="recruiter-field recruiter-field-full">
                                Job title
                                <input
                                    name="title"
                                    value={form.title}
                                    onChange={handleChange}
                                    placeholder="e.g. Frontend Developer"
                                    maxLength={120}
                                    required
                                />
                            </label>

                            <label className="recruiter-field">
                                Company
                                <input
                                    name="company_name"
                                    value={form.company_name}
                                    onChange={handleChange}
                                    placeholder="Company name"
                                    maxLength={120}
                                    required
                                />
                            </label>

                            <label className="recruiter-field">
                                Location
                                <input
                                    name="location"
                                    value={form.location}
                                    onChange={handleChange}
                                    placeholder="City, province or remote"
                                    maxLength={120}
                                    required
                                />
                            </label>

                            <label className="recruiter-field recruiter-field-full">
                                Category
                                <input
                                    name="category"
                                    value={form.category}
                                    onChange={handleChange}
                                    placeholder="e.g. Software, Design, Data"
                                    maxLength={80}
                                    required
                                />
                            </label>

                            <label className="recruiter-field">
                                Minimum salary (CAD/year)
                                <input
                                    name="min_salary"
                                    type="number"
                                    min="0"
                                    step="1"
                                    inputMode="numeric"
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
                                    step="1"
                                    inputMode="numeric"
                                    value={form.max_salary}
                                    onChange={handleChange}
                                    placeholder="Optional"
                                />
                            </label>

                            <label className="recruiter-field recruiter-field-full">
                                Job description
                                <textarea
                                    name="description"
                                    value={form.description}
                                    onChange={handleChange}
                                    placeholder="Describe the role, responsibilities, and qualifications."
                                    rows="6"
                                    maxLength={5000}
                                    required
                                />
                            </label>
                        </div>

                        {error && <p className="recruiter-error" role="alert">{error}</p>}

                        <div className="recruiter-form-actions">
                            <button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Publishing…' : 'Publish job listing'}
                            </button>
                        </div>
                    </form>
                </section>

                <aside className="recruiter-side-panel" aria-labelledby="recent-listings-heading">
                    <div className="recruiter-panel-heading">
                        <div>
                            <h2 id="recent-listings-heading">Recently created</h2>
                            <p>Listings you have published in this session.</p>
                        </div>
                    </div>
                    {listings.length ? (
                        <ul className="recruiter-listings">
                            {listings.map((job) => (
                                <li key={job.id} className="recruiter-listing">
                                    <h3>{job.title}</h3>
                                    <p>{job.company}</p>
                                    <p className="recruiter-listing-meta">
                                        {job.location} · {job.category}
                                    </p>
                                    {job.salary && (
                                        <p className="recruiter-listing-meta">{job.salary}</p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="recruiter-empty" role="status">
                            Your published listings will appear here.
                        </p>
                    )}
                </aside>
            </div>
        </div>
    )
}

export default RecruiterDashboard
