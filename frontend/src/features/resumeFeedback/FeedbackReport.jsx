import styles from './ResumeFeedback.module.css'

const reviewedLabel = (iso) =>
    new Date(iso).toLocaleString('en-CA', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    })

// The finished review: suggestions to act on first, then what to revisit,
// then what is already good. `done` is the list of ticked suggestion numbers.
export default function FeedbackReport({ feedback, fileName, done, onToggle }) {
    const total = feedback.recommendations.length
    const ticked = done.filter((i) => i < total).length

    return (
        <article className={styles.sheet} aria-labelledby="report-title">
            <header className={styles.reportHead}>
                <div>
                    <p className={styles.kicker}>Notes on</p>
                    <h2 id="report-title" className={styles.fileTitle}>{fileName}</h2>
                    <p className={styles.reviewed}>Reviewed {reviewedLabel(feedback.reviewedAt)}</p>
                </div>
            </header>

            {total > 0 && (
                <section className={styles.block}>
                    <div className={styles.blockHead}>
                        <h3>Start here</h3>
                        <span className={styles.progress} aria-live="polite">
                            {ticked} of {total} done
                        </span>
                    </div>
                    <ol className={styles.todo}>
                        {feedback.recommendations.map((text, i) => {
                            const isDone = done.includes(i)
                            return (
                                <li key={text} className={isDone ? styles.todoDone : ''}>
                                    <label>
                                        <input type="checkbox" checked={isDone} onChange={() => onToggle(i)} />
                                        <span className={styles.todoNum} aria-hidden="true">{i + 1}</span>
                                        <span className={styles.todoText}>{text}</span>
                                    </label>
                                </li>
                            )
                        })}
                    </ol>
                </section>
            )}

            {feedback.improvements.length > 0 && (
                <section className={styles.block}>
                    <div className={styles.blockHead}>
                        <h3>Worth a second look</h3>
                    </div>
                    <ul className={styles.notes}>
                        {feedback.improvements.map((text) => (
                            <li key={text}>{text}</li>
                        ))}
                    </ul>
                </section>
            )}

            {feedback.strengths.length > 0 && (
                <section className={styles.block}>
                    <div className={styles.blockHead}>
                        <h3>Already working</h3>
                    </div>
                    <ul className={styles.notes}>
                        {feedback.strengths.map((text) => (
                            <li key={text}>{text}</li>
                        ))}
                    </ul>
                </section>
            )}

            {total + feedback.improvements.length + feedback.strengths.length === 0 && (
                <p className={styles.reviewed}>The review came back empty. Try running it again.</p>
            )}

            <p className={styles.disclaimer}>
                These notes are written by an AI model. It can miss context or get things wrong, so treat
                them as a second opinion, not a verdict.
            </p>
        </article>
    )
}
