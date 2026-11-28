import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, Card } from '../../components/common'
import { getUserId } from '../../services/session.js'
import {
    finalizeInterviewOption,
    getInterviewCoordination,
    proposeInterviewOptions,
    sendInterviewMessage,
} from '../../services/interviewCoordinationApi.js'
import styles from './InterviewCoordination.module.css'

const emptyOption = () => ({ id: `${Date.now()}-${Math.random()}`, value: '' })

function dateLabel(value) {
    return new Date(value).toLocaleString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    })
}

export default function InterviewCoordinationPage() {
    const { applicationId } = useParams()
    const [coordination, setCoordination] = useState(null)
    const [options, setOptions] = useState([emptyOption(), emptyOption(), emptyOption()])
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [savingOptions, setSavingOptions] = useState(false)
    const [sendingMessage, setSendingMessage] = useState(false)
    const [finalizingId, setFinalizingId] = useState(null)

    const loadCoordination = useCallback(async () => {
        try {
            const result = await getInterviewCoordination(applicationId)
            setCoordination(result)
            setError('')
        } catch (requestError) {
            setError(requestError.message || 'Unable to load interview coordination.')
        }
    }, [applicationId])

    useEffect(() => {
        const initialLoad = window.setTimeout(loadCoordination, 0)
        const interval = window.setInterval(loadCoordination, 20_000)
        return () => {
            window.clearTimeout(initialLoad)
            window.clearInterval(interval)
        }
    }, [loadCoordination])

    async function submitOptions(event) {
        event.preventDefault()
        const selected = options.map((item) => item.value).filter(Boolean)
        if (selected.length < 2) {
            setError('Select at least two interview times.')
            return
        }
        setSavingOptions(true)
        setError('')
        try {
            await proposeInterviewOptions(
                applicationId,
                selected.map((value) => new Date(value).toISOString()),
            )
            setOptions([emptyOption(), emptyOption(), emptyOption()])
            await loadCoordination()
        } catch (requestError) {
            setError(requestError.message || 'Unable to submit interview options.')
        } finally {
            setSavingOptions(false)
        }
    }

    async function submitMessage(event) {
        event.preventDefault()
        if (!message.trim()) return
        setSendingMessage(true)
        setError('')
        try {
            await sendInterviewMessage(applicationId, message.trim())
            setMessage('')
            await loadCoordination()
        } catch (requestError) {
            setError(requestError.message || 'Unable to send your message.')
        } finally {
            setSendingMessage(false)
        }
    }

    async function confirmOption(optionId) {
        setFinalizingId(optionId)
        setError('')
        try {
            await finalizeInterviewOption(applicationId, optionId)
            await loadCoordination()
        } catch (requestError) {
            setError(requestError.message || 'Unable to confirm this interview time.')
        } finally {
            setFinalizingId(null)
        }
    }

    if (!coordination && !error) return <p role="status">Loading interview coordination…</p>
    if (!coordination) {
        return (
            <div className={styles.page}>
                <Alert tone="error">{error || 'Interview coordination is unavailable.'}</Alert>
                <Link to="/applications">My Applications</Link>
            </div>
        )
    }

    const isApplicant = coordination.role === 'applicant'
    const finalOption = coordination.options.find((item) => item.is_final)
    const canPropose = isApplicant && !finalOption

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <Link to={isApplicant ? '/applications' : '/recruiter'}>{isApplicant ? 'My Applications' : '← Back'}</Link>
                    <h1>Interview scheduling</h1>
                    <p>{coordination.job_title}{coordination.company && ` · ${coordination.company}`}</p>
                </div>
                <span className={styles.roleTag}>{isApplicant ? 'Job seeker' : 'Recruiter'}</span>
            </header>
            {error && <Alert tone="error">{error}</Alert>}
            {finalOption && (
                <Card className={styles.confirmed}>
                    <strong>Interview time confirmed</strong>
                    <p>{dateLabel(finalOption.proposed_at)}</p>
                </Card>
            )}
            <div className={styles.columns}>
                <Card className={styles.card}>
                    <h2>Suggested times</h2>
                    <p className={styles.muted}>
                        {isApplicant
                            ? 'Share a few times that work for you. The recruiter will confirm one.'
                            : 'Choose the final interview time from the job seeker’s suggestions.'}
                    </p>
                    {coordination.options.length ? (
                        <ul className={styles.optionList}>
                            {coordination.options.map((option) => (
                                <li key={option.id} className={option.is_final ? styles.finalOption : ''}>
                                    <span>{dateLabel(option.proposed_at)}</span>
                                    {option.is_final ? (
                                        <strong>Confirmed</strong>
                                    ) : !isApplicant ? (
                                        <button
                                            type="button"
                                            disabled={Boolean(finalOption) || finalizingId === option.id}
                                            onClick={() => confirmOption(option.id)}
                                        >
                                            {finalizingId === option.id ? 'Confirming…' : 'Confirm this time'}
                                        </button>
                                    ) : (
                                        <small>Awaiting recruiter</small>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className={styles.empty}>No times have been suggested yet.</p>
                    )}
                    {canPropose && (
                        <form className={styles.optionForm} onSubmit={submitOptions}>
                            <h3>Suggest your availability</h3>
                            {options.map((option, index) => (
                                <label key={option.id}>
                                    Option {index + 1}
                                    <input
                                        type="datetime-local"
                                        value={option.value}
                                        onChange={(event) => setOptions((current) =>
                                            current.map((item) => item.id === option.id
                                                ? { ...item, value: event.target.value }
                                                : item),
                                        )}
                                    />
                                </label>
                            ))}
                            {options.length < 5 && (
                                <button
                                    type="button"
                                    className={styles.textButton}
                                    onClick={() => setOptions((current) => [...current, emptyOption()])}
                                >
                                    Add another time
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={savingOptions || options.filter((item) => item.value).length < 2}
                            >
                                {savingOptions ? 'Sending…' : 'Send availability'}
                            </button>
                        </form>
                    )}
                </Card>
                <Card className={styles.card}>
                    <h2>Chat</h2>
                    <div className={styles.messages} aria-live="polite">
                        {coordination.messages.length ? coordination.messages.map((item) => (
                            <article
                                key={item.id}
                                className={String(item.sender_id) === String(getUserId())
                                    ? styles.ownMessage
                                    : styles.otherMessage}
                            >
                                <p>{item.message}</p>
                                <time dateTime={item.created_at}>{dateLabel(item.created_at)}</time>
                            </article>
                        )) : <p className={styles.empty}>Use this chat to coordinate details with each other.</p>}
                    </div>
                    <form className={styles.messageForm} onSubmit={submitMessage}>
                        <label htmlFor="interview-message">Message</label>
                        <textarea
                            id="interview-message"
                            value={message}
                            maxLength={2000}
                            onChange={(event) => setMessage(event.target.value)}
                            required
                        />
                        <button type="submit" disabled={sendingMessage || !message.trim()}>
                            {sendingMessage ? 'Sending…' : 'Send message'}
                        </button>
                    </form>
                </Card>
            </div>
        </div>
    )
}
