import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '../../components/common'
import useResumes from '../../hooks/useResumes.js'
import { formatDate, formatFileSize } from '../../services/format.js'
import {
    loadSavedFeedback,
    NO_RESUME,
    requestResumeFeedback,
    saveFeedback,
} from '../../services/resumeFeedbackApi.js'
import FeedbackReport from './FeedbackReport.jsx'
import styles from './ResumeFeedback.module.css'

// The six things the backend asks the AI to look at (see ai_resume_service.py).
const CRITERIA = [
    'Contact information',
    'Work experience',
    'Education',
    'Skills',
    'Formatting and organization',
    'Grammar and clarity',
]

// Shown one after another while we wait for the backend.
const WAITING_LINES = ['Opening your resume…', 'Reading it through…', 'Writing up the notes…']

// The (i) next to the page title. Click it to see what this page does.
function InfoButton() {
    const [open, setOpen] = useState(false)
    const wrapRef = useRef(null)

    // Close when clicking anywhere else or pressing Escape.
    useEffect(() => {
        if (!open) return undefined
        const onClick = (e) => {
            if (!wrapRef.current?.contains(e.target)) setOpen(false)
        }
        const onKey = (e) => e.key === 'Escape' && setOpen(false)
        document.addEventListener('mousedown', onClick)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onClick)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    return (
        <div className={styles.infoWrap} ref={wrapRef}>
            <button
                type="button"
                className={styles.infoBtn}
                aria-label="What is resume feedback?"
                aria-expanded={open}
                aria-controls="resume-feedback-info"
                onClick={() => setOpen((o) => !o)}
            >
                i
            </button>
            {open && (
                <div id="resume-feedback-info" role="dialog" aria-label="About resume feedback" className={styles.infoPop}>
                    <strong>What is this?</strong>
                    <p>
                        An AI model reads the resume on your profile and writes notes on it: what to change
                        first, what to look at again, and what already works.
                    </p>
                    <p>
                        Upload a new resume on your profile? Run it again to get fresh notes. Your resume is
                        not shared with employers.
                    </p>
                </div>
            )}
        </div>
    )
}

// Route: /resume-feedback — AI-Powered Resume Feedback.
// Sprint 3: review the profile resume and show the notes.
// Sprint 4 ideas: aim the review at a specific job posting, keep past reviews.
export default function ResumeFeedbackPage() {
    const { resumes, loading: resumesLoading } = useResumes()
    const resume = resumes.find((r) => r.is_default) ?? resumes[0] ?? null

    const [saved, setSaved] = useState(() => loadSavedFeedback())
    const [running, setRunning] = useState(false)
    const [waitingLine, setWaitingLine] = useState(0)
    const [error, setError] = useState(null)

    // Rotate the "working on it" message while the request runs.
    useEffect(() => {
        if (!running) return undefined
        const timer = setInterval(() => setWaitingLine((n) => Math.min(n + 1, WAITING_LINES.length - 1)), 1100)
        return () => clearInterval(timer)
    }, [running])

    // Only show saved notes if they belong to the resume that is on the profile now.
    const current = saved && resume && saved.fileName === resume.file_name ? saved : null
    const outdated = saved && resume && !current

    async function runReview() {
        setWaitingLine(0)
        setRunning(true)
        setError(null)
        try {
            const feedback = await requestResumeFeedback()
            const entry = { ...feedback, fileName: resume?.file_name ?? 'Your resume', done: [] }
            saveFeedback(entry)
            setSaved(entry)
        } catch (e) {
            setError(e)
        } finally {
            setRunning(false)
        }
    }

    function toggleDone(index) {
        setSaved((prev) => {
            const done = prev.done.includes(index) ? prev.done.filter((i) => i !== index) : [...prev.done, index]
            const next = { ...prev, done }
            saveFeedback(next)
            return next
        })
    }

    return (
        <div className={styles.page}>
            <header className={styles.heading}>
                <h1 className={styles.title}>Resume feedback</h1>
                <InfoButton />
            </header>

            <div className={styles.layout}>
                <aside className={styles.side}>
                    <section className={styles.sideCard} aria-labelledby="your-resume">
                        <h2 id="your-resume" className={styles.sideTitle}>Your resume</h2>

                        {resumesLoading ? (
                            <p className={styles.muted}>Loading…</p>
                        ) : resume ? (
                            <>
                                <div className={styles.file}>
                                    <span className={styles.fileIcon} aria-hidden="true">
                                        {/\.pdf$/i.test(resume.file_name) ? 'PDF' : 'DOC'}
                                    </span>
                                    <span className={styles.fileText}>
                                        <strong>{resume.file_name}</strong>
                                        <small>
                                            {formatFileSize(resume.file_size)} · uploaded {formatDate(resume.uploaded_at)}
                                        </small>
                                    </span>
                                </div>
                                <Link to="/profile#resumes" className={styles.smallLink}>Change it on your profile</Link>

                                <button
                                    type="button"
                                    className={styles.runBtn}
                                    onClick={runReview}
                                    disabled={running}
                                >
                                    {running ? 'Reviewing…' : current ? 'Get new feedback' : 'Review my resume'}
                                </button>
                            </>
                        ) : (
                            <>
                                <p className={styles.muted}>
                                    You haven’t uploaded a resume yet. Add one to your profile and it will show up here.
                                </p>
                                <Link to="/profile#resumes" className={styles.runBtnLink}>Upload a resume</Link>
                            </>
                        )}
                    </section>

                    <section className={styles.sideCard} aria-labelledby="criteria">
                        <h2 id="criteria" className={styles.sideTitle}>What gets checked</h2>
                        <ul className={styles.criteria}>
                            {CRITERIA.map((c) => (
                                <li key={c}>{c}</li>
                            ))}
                        </ul>
                        <p className={styles.privacy}>
                            The text of your resume is sent to an AI model to write these notes. It is not shared
                            with employers. Takes about 10–20 seconds.
                        </p>
                    </section>
                </aside>

                <div className={styles.main} aria-live="polite" aria-busy={running}>
                    {error && (
                        <div className={styles.errorWrap}>
                            <Alert tone="error">
                                {error.message}{' '}
                                {error.code === NO_RESUME && <Link to="/profile#resumes">Go to your profile</Link>}
                            </Alert>
                        </div>
                    )}

                    {running ? (
                        <div className={`${styles.sheet} ${styles.sheetWaiting}`}>
                            <p className={styles.waitingText}>{WAITING_LINES[waitingLine]}</p>
                            <div className={styles.ghostLines} aria-hidden="true">
                                {[92, 78, 85, 60, 88, 70, 45].map((w, i) => (
                                    <span key={i} style={{ width: `${w}%`, animationDelay: `${i * 0.12}s` }} />
                                ))}
                            </div>
                        </div>
                    ) : current ? (
                        <FeedbackReport
                            feedback={current}
                            fileName={current.fileName}
                            done={current.done ?? []}
                            onToggle={toggleDone}
                        />
                    ) : (
                        <div className={`${styles.sheet} ${styles.sheetEmpty}`}>
                            <h2>No notes yet</h2>
                            <p>
                                {!resumesLoading && !resume
                                    ? 'Upload a resume on your profile first. Then come back here and review it.'
                                    : outdated
                                      ? `Your last review was for ${saved.fileName}. You’ve changed your resume since, so run a new one.`
                                      : 'Click “Review my resume” and your notes will show up here, sorted into what to change first, what to look at again, and what already works.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
