import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '../../components/common'
import useResumes from '../../hooks/useResumes.js'
import { listMyApplications } from '../../services/applicationApi.js'
import {
    loadSavedMatches,
    NEEDS_PROFILE,
    requestJobMatches,
    saveMatches,
    skillGaps,
} from '../../services/jobMatchingApi.js'
import { getFullProfile } from '../../services/profileApi.js'
import MatchCard from './MatchCard.jsx'
import styles from './JobMatching.module.css'

// Shown one after another while the AI works.
const WAITING_LINES = ['Reading your profile…', 'Comparing it with open postings…', 'Ranking the best fits…']

const updatedLabel = (iso) =>
    new Date(iso).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : /(s|x|ch|sh)$/.test(word) ? 'es' : 's'}`

// Left column: exactly what the matcher reads, so the user knows what to improve.
function MatchInputs({ profile, resume, loading }) {
    const rows = profile
        ? [
              ['Headline', profile.profile?.title || null],
              ['Skills', profile.skills.length ? plural(profile.skills.length, 'skill') : null],
              ['Experience', profile.experiences.length ? plural(profile.experiences.length, 'role') : null],
              ['Education', profile.education.length ? `${profile.education.length} ${profile.education.length === 1 ? 'entry' : 'entries'}` : null],
              ['Resume', resume?.file_name ?? null],
          ]
        : []
    const filled = rows.filter(([, v]) => v).length

    return (
        <section className={styles.sideCard} aria-labelledby="match-inputs">
            <h2 id="match-inputs" className={styles.sideTitle}>What we match on</h2>
            {loading ? (
                <p className={styles.muted}>Loading your profile…</p>
            ) : (
                <>
                    <div className={styles.meter} aria-hidden="true">
                        <span style={{ width: `${(filled / Math.max(rows.length, 1)) * 100}%` }} />
                    </div>
                    <p className={styles.meterText}>{filled} of {rows.length} filled in</p>
                    <ul className={styles.inputs}>
                        {rows.map(([label, value]) => (
                            <li key={label} className={value ? styles.inputOn : styles.inputOff}>
                                <span className={styles.inputMark} aria-hidden="true">{value ? '✓' : '+'}</span>
                                <span className={styles.inputLabel}>{label}</span>
                                <span className={styles.inputValue}>{value ?? 'Missing'}</span>
                            </li>
                        ))}
                    </ul>
                    {filled < rows.length && (
                        <Link to="/profile" className={styles.smallLink}>Fill in your profile for better matches</Link>
                    )}
                </>
            )}
        </section>
    )
}

function SkillGaps({ matches }) {
    const gaps = skillGaps(matches).slice(0, 6)
    if (!gaps.length) return null
    return (
        <section className={styles.sideCard} aria-labelledby="skill-gaps">
            <h2 id="skill-gaps" className={styles.sideTitle}>Skills you’re missing most</h2>
            <p className={styles.muted}>Skills your matches ask for that aren’t on your profile yet.</p>
            <ul className={styles.gaps}>
                {gaps.map(({ skill, count }) => (
                    <li key={skill}>
                        <span>{skill}</span>
                        <span className={styles.gapCount}>
                            {count} of {matches.length} matches
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    )
}

// Route: /matches — AI Job Matching Suggestions (Sprint 4).
// Recommends the open jobs that best fit the user's profile and resume.
export default function JobMatchesPage() {
    const { resumes, loading: resumesLoading } = useResumes()
    const resume = resumes.find((r) => r.is_default) ?? resumes[0] ?? null

    const [profile, setProfile] = useState(null)
    const [profileLoading, setProfileLoading] = useState(true)
    const [appliedIds, setAppliedIds] = useState(() => new Set())
    const [result, setResult] = useState(() => loadSavedMatches())
    const [running, setRunning] = useState(false)
    const [waitingLine, setWaitingLine] = useState(0)
    const [error, setError] = useState(null)
    const [hideApplied, setHideApplied] = useState(false)

    useEffect(() => {
        let active = true
        getFullProfile()
            .then((p) => active && setProfile(p))
            .catch(() => active && setProfile(null))
            .finally(() => active && setProfileLoading(false))
        listMyApplications()
            .then((apps) => active && setAppliedIds(new Set(apps.map((a) => String(a.job_id)))))
            .catch(() => {})
        return () => {
            active = false
        }
    }, [])

    useEffect(() => {
        if (!running) return undefined
        const timer = setInterval(() => setWaitingLine((n) => Math.min(n + 1, WAITING_LINES.length - 1)), 1200)
        return () => clearInterval(timer)
    }, [running])

    async function findMatches() {
        setWaitingLine(0)
        setRunning(true)
        setError(null)
        try {
            const next = await requestJobMatches()
            saveMatches(next)
            setResult(next)
        } catch (e) {
            setError(e)
        } finally {
            setRunning(false)
        }
    }

    const matches = result?.matches ?? []
    const shown = hideApplied ? matches.filter((m) => !appliedIds.has(String(m.job.id))) : matches
    const appliedCount = matches.length - matches.filter((m) => !appliedIds.has(String(m.job.id))).length

    return (
        <div className={styles.page}>
            <header className={styles.heading}>
                <div>
                    <p className={styles.kicker}>AI suggestions</p>
                    <h1 className={styles.title}>Job matches</h1>
                    <p className={styles.subtitle}>
                        Open postings ranked by how well they fit your profile and resume.
                    </p>
                </div>
                <button type="button" className={styles.runBtn} onClick={findMatches} disabled={running}>
                    {running ? 'Matching…' : result ? 'Refresh matches' : 'Find my matches'}
                </button>
            </header>

            <div className={styles.layout}>
                <aside className={styles.side}>
                    <MatchInputs profile={profile} resume={resume} loading={profileLoading || resumesLoading} />
                    {!running && <SkillGaps matches={matches} />}
                    <p className={styles.privacy}>
                        Your email and phone number are removed before anything is sent to the AI. Scores estimate
                        relevance, not your chances of getting an offer.
                    </p>
                </aside>

                <div className={styles.main} aria-live="polite" aria-busy={running}>
                    {error && (
                        <div className={styles.errorWrap}>
                            <Alert tone="error">
                                {error.message}{' '}
                                {error.code === NEEDS_PROFILE && <Link to="/profile">Go to your profile</Link>}
                            </Alert>
                        </div>
                    )}

                    {running ? (
                        <div className={styles.waiting}>
                            <p className={styles.waitingText}>{WAITING_LINES[waitingLine]}</p>
                            <ul className={styles.list} aria-hidden="true">
                                {[0, 1, 2].map((i) => (
                                    <li key={i} className={`${styles.card} ${styles.ghost}`} style={{ animationDelay: `${i * 0.15}s` }}>
                                        <span className={styles.ghostLogo} />
                                        <span className={styles.ghostLines}>
                                            <span style={{ width: '55%' }} />
                                            <span style={{ width: '35%' }} />
                                            <span style={{ width: '80%' }} />
                                        </span>
                                        <span className={styles.ghostDial} />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : result ? (
                        <>
                            <div className={styles.summary}>
                                <p role="status">
                                    <strong>{plural(matches.length, 'match')}</strong>
                                    {result.jobsAnalyzed != null && ` from ${plural(result.jobsAnalyzed, 'open posting')}`}
                                    {' · '}based on your profile{result.resumeUsed ? ' and resume' : ''}
                                    {' · '}updated {updatedLabel(result.generatedAt)}
                                </p>
                                {appliedCount > 0 && (
                                    <label className={styles.toggle}>
                                        <input
                                            type="checkbox"
                                            checked={hideApplied}
                                            onChange={(e) => setHideApplied(e.target.checked)}
                                        />
                                        Hide jobs I’ve applied to ({appliedCount})
                                    </label>
                                )}
                            </div>

                            {result.warnings.map((w) => (
                                <div key={w} className={styles.errorWrap}>
                                    <Alert tone="info">
                                        {w}{' '}
                                        {/resume/i.test(w) && <Link to="/profile#resumes">Upload a resume</Link>}
                                    </Alert>
                                </div>
                            ))}

                            {matches.length === 0 ? (
                                <div className={styles.empty}>
                                    <h2>No matches this time</h2>
                                    <p>
                                        {result.message ||
                                            'None of the open postings looked like a fit. Add more skills or experience to your profile, or check back when new jobs are posted.'}
                                    </p>
                                    <Link to="/jobs" className={styles.smallLink}>Browse all jobs</Link>
                                </div>
                            ) : shown.length === 0 ? (
                                <div className={styles.empty}>
                                    <h2>You’ve applied to all of these</h2>
                                    <p>Refresh your matches later to see new suggestions.</p>
                                </div>
                            ) : (
                                <ol className={styles.list} aria-label="Recommended jobs">
                                    {shown.map((m) => (
                                        <MatchCard
                                            key={m.job.id}
                                            match={m}
                                            rank={matches.indexOf(m) + 1}
                                            applied={appliedIds.has(String(m.job.id))}
                                        />
                                    ))}
                                </ol>
                            )}
                        </>
                    ) : (
                        <div className={styles.empty}>
                            <h2>No matches yet</h2>
                            <p>
                                Click “Find my matches” and the AI will compare your profile and resume with every open
                                posting, then show you the best fits with the reasons behind each one.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
