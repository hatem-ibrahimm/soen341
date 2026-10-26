import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, Card, FilePicker, FormGrid, TextField } from '../../components/common'
import { useCurrentUser } from '../../context/CurrentUserContext.jsx'
import useResumes from '../../hooks/useResumes.js'
import { COVER_LETTER_MAX as COVER_MAX, findApplicationForJob, submitApplication } from '../../services/applicationApi.js'
import { formatDate, formatFileSize } from '../../services/format.js'
import { getJob } from '../../services/jobsApi.js'
import { MULTIPLE_RESUMES, RESUME_ACCEPT } from '../../services/resumeApi.js'
import JobSummaryCard from './JobSummaryCard.jsx'
import styles from './Applications.module.css'

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// Route: /jobs/:jobId/apply  — the job listing's "Apply" button links here.
export default function ApplyPage() {
    const { jobId } = useParams()
    const navigate = useNavigate()
    const { user } = useCurrentUser()
    const resumes = useResumes()

    const [job, setJob] = useState(null)
    const [existing, setExisting] = useState(null)
    const [loadError, setLoadError] = useState('')
    // null = "not edited yet", so the value falls back to the profile / default resume
    const [edits, setEdits] = useState({ email: null, phone_number: null, cover_letter: '' })
    const [pickedResumeId, setResumeId] = useState('')
    const [errors, setErrors] = useState({})
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState('')

    useEffect(() => {
        Promise.all([getJob(jobId), findApplicationForJob(jobId)])
            .then(([j, app]) => {
                setJob(j)
                setExisting(app)
            })
            .catch((e) => setLoadError(e.message))
    }, [jobId])

    // Contact info is pre-filled from the profile; the default resume is pre-selected.
    const form = {
        email: edits.email ?? user?.email ?? '',
        phone_number: edits.phone_number ?? user?.phone_number ?? '',
        cover_letter: edits.cover_letter,
    }
    const defaultResume = resumes.resumes.find((r) => r.is_default) ?? resumes.resumes[0]
    const resumeId = resumes.resumes.some((r) => r.id === pickedResumeId) ? pickedResumeId : defaultResume?.id ?? ''

    async function handleUpload(file) {
        const r = await resumes.upload(file)
        if (r) setResumeId(r.id)
    }

    async function submit(e) {
        e.preventDefault()
        const found = {}
        if (!EMAIL.test(form.email.trim())) found.email = 'Enter a valid email address.'
        if (!form.phone_number.trim()) found.phone_number = 'Phone number is required.'
        if (!resumeId) found.resume = 'Please select or upload a resume.'
        if (form.cover_letter.length > COVER_MAX) found.cover_letter = `Keep it under ${COVER_MAX} characters.`
        setErrors(found)
        if (Object.keys(found).length) return

        setSubmitting(true)
        setSubmitError('')
        try {
            const app = await submitApplication({
                job_id: jobId,
                resume_id: resumeId,
                email: form.email.trim(),
                phone_number: form.phone_number.trim(),
                cover_letter: form.cover_letter.trim(),
            })
            navigate(`/applications/${app.id}/submitted`, { replace: true })
        } catch (err) {
            setSubmitError(err.message)
            setSubmitting(false)
        }
    }

    if (loadError) return <Alert tone="error">{loadError} <Link to="/jobs">Back to jobs</Link></Alert>
    if (!job) return <p className={styles.muted}>Loading job…</p>

    const change = (e) => setEdits({ ...edits, [e.target.name]: e.target.value })

    return (
        <div className={styles.applyLayout}>
            <div>
                <Link to="/jobs" className={styles.back}>← Back to jobs</Link>
                <h1 className={styles.pageTitle}>Apply to {job.company}</h1>

                {existing ? (
                    <Card>
                        <Alert tone="info">
                            You already applied to this job on {formatDate(existing.applied_at)}. Current status: <strong>{existing.status}</strong>.
                        </Alert>
                        <div style={{ marginTop: 14 }}>
                            <Link to={`/applications?highlight=${existing.id}`} className={styles.primaryLink}>Track this application</Link>
                        </div>
                    </Card>
                ) : (
                    <form onSubmit={submit} noValidate className={styles.applyForm}>
                        <Card title="1. Contact info">
                            <FormGrid>
                                <TextField label="Email" name="email" type="email" required value={form.email} onChange={change} error={errors.email} />
                                <TextField label="Phone" name="phone_number" required value={form.phone_number} onChange={change} error={errors.phone_number} />
                            </FormGrid>
                            <p className={styles.small}>Pre-filled from your <Link to="/profile">profile</Link>.</p>
                        </Card>

                        <Card title="2. Resume">
                            {resumes.error && <Alert tone="error">{resumes.error}</Alert>}
                            {errors.resume && <Alert tone="error">{errors.resume}</Alert>}
                            {resumes.loading ? (
                                <p className={styles.muted}>Loading resumes…</p>
                            ) : (
                                <div className={styles.resumeChoices} role="radiogroup" aria-label="Choose a resume">
                                    {resumes.resumes.map((r) => (
                                        <label key={r.id} className={`${styles.resumeChoice} ${resumeId === r.id ? styles.selected : ''}`}>
                                            <input type="radio" name="resume" value={r.id} checked={resumeId === r.id} onChange={() => setResumeId(r.id)} />
                                            <span className={styles.fileBadge}>{/\.pdf$/i.test(r.file_name) ? 'PDF' : 'DOC'}</span>
                                            <span className={styles.resumeText}>
                                                <strong>{r.file_name}</strong>
                                                <small>
                                                    {formatFileSize(r.file_size)} · Uploaded {formatDate(r.uploaded_at)}
                                                    {r.is_default && ' · Default'}
                                                </small>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            )}
                            {(MULTIPLE_RESUMES || resumes.resumes.length === 0) && (
                                <FilePicker
                                    accept={RESUME_ACCEPT}
                                    onSelect={handleUpload}
                                    disabled={resumes.busyId === 'new'}
                                    label={resumes.busyId === 'new' ? 'Uploading…' : 'Upload a different resume'}
                                    hint="PDF or DOC · 5 MB max · also saved to your profile"
                                />
                            )}
                        </Card>

                        <Card title="3. Cover letter (optional)">
                            <TextField
                                label="Why are you a good fit?"
                                name="cover_letter"
                                multiline
                                rows={6}
                                value={form.cover_letter}
                                onChange={change}
                                error={errors.cover_letter}
                                hint={`${form.cover_letter.length}/${COVER_MAX}`}
                            />
                        </Card>

                        {submitError && <Alert tone="error">{submitError}</Alert>}
                        <div className={styles.submitRow}>
                            <Button variant="ghost" onClick={() => navigate('/jobs')}>Cancel</Button>
                            <Button type="submit" disabled={submitting}>
                                {submitting ? 'Submitting…' : 'Submit application'}
                            </Button>
                        </div>
                    </form>
                )}
            </div>
            <aside className={styles.applyAside}>
                <JobSummaryCard job={job} />
            </aside>
        </div>
    )
}
