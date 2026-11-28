import { Link } from 'react-router-dom'
import { CompanyLogo } from '../../components/common'
import { scoreBand } from '../../services/jobMatchingApi.js'
import styles from './JobMatching.module.css'

// Badge with the match level and the score, e.g. "Strong match · 91%".
function ScoreBadge({ score }) {
    const { label, tone } = scoreBand(score)
    return (
        <span className={`${styles.scoreBadge} ${styles[tone]}`} aria-label={`${label}, ${score}% match`}>
            {label} · <strong>{score}%</strong>
        </span>
    )
}

// One recommended job: score, why it fits, skills you have / could build, and actions.
export default function MatchCard({ match, rank, applied }) {
    const { job } = match
    const company = job.company_name ?? job.company ?? ''
    const jobPath = `/jobs/${encodeURIComponent(job.id)}`
    const headingId = `match-${job.id}`

    return (
        <li className={styles.card}>
            <article aria-labelledby={headingId}>
                <div className={styles.cardTop}>
                    <span className={styles.rank} aria-label={`Rank ${rank}`}>#{rank}</span>
                    <CompanyLogo name={company} size={44} />
                    <div className={styles.cardInfo}>
                        <h3 id={headingId} className={styles.jobTitle}>
                            <Link to={jobPath}>{job.title}</Link>
                        </h3>
                        <p className={styles.company}>{company}</p>
                        <p className={styles.meta}>{[job.location, job.category ?? job.type].filter(Boolean).join(' · ')}</p>
                    </div>
                    <ScoreBadge score={match.score} />
                </div>

                {match.explanation && (
                    <div className={styles.why}>
                        <span className={styles.whyLabel}>Why it fits</span>
                        <p>{match.explanation}</p>
                    </div>
                )}

                <div className={styles.skillRows}>
                    {match.matchingSkills.length > 0 && (
                        <div className={styles.skillRow}>
                            <span className={styles.skillLabel}>Skills you have</span>
                            <ul className={styles.chips} aria-label="Skills you have">
                                {match.matchingSkills.map((s) => (
                                    <li key={s} className={styles.chipHave}>{s}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {match.missingSkills.length > 0 && (
                        <div className={styles.skillRow}>
                            <span className={styles.skillLabel}>Skills to learn</span>
                            <ul className={styles.chips} aria-label="Skills to learn">
                                {match.missingSkills.map((s) => (
                                    <li key={s} className={styles.chipGap}>{s}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <div className={styles.actions}>
                    <Link to={jobPath} className={styles.secondaryBtn}>View job</Link>
                    {applied ? (
                        <Link to="/applications" className={styles.appliedBtn}>Applied ✓</Link>
                    ) : (
                        <Link to={`${jobPath}/apply`} className={styles.primaryBtn}>Apply</Link>
                    )}
                </div>
            </article>
        </li>
    )
}
