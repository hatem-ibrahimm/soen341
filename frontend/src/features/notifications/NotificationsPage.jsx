import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Card, EmptyState } from '../../components/common'
import { deleteNotification, listNotifications, markNotificationRead } from '../../services/notificationsApi.js'
import { timeAgo } from '../../services/format.js'
import styles from './Notifications.module.css'

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState(null)
    const [error, setError] = useState('')
    const [actionError, setActionError] = useState('')
    const [retryCount, setRetryCount] = useState(0)

    useEffect(() => {
        let active = true
        const load = () => {
            listNotifications()
                .then((items) => {
                    if (active) {
                        setNotifications(items)
                        setError('')
                    }
                })
                .catch((requestError) => {
                    if (active) setError(requestError.message || 'Unable to load notifications.')
                })
        }

        load()
        const interval = window.setInterval(load, 30_000)
        return () => {
            active = false
            window.clearInterval(interval)
        }
    }, [retryCount])

    async function markAsRead(notificationId) {
        setActionError('')
        try {
            await markNotificationRead(notificationId)
            setNotifications((items) =>
                items.map((item) =>
                    item.id === notificationId ? { ...item, is_read: true } : item,
                ),
            )
            window.dispatchEvent(new Event('notifications:updated'))
        } catch (requestError) {
            setActionError(requestError.message || 'Unable to update this notification.')
        }
    }

    async function removeNotification(notificationId) {
        setActionError('')
        try {
            await deleteNotification(notificationId)
            setNotifications((items) =>
                items.filter((item) => item.id !== notificationId),
            )
            window.dispatchEvent(new Event('notifications:updated'))
        } catch (requestError) {
            setActionError(requestError.message || 'Unable to delete this notification.')
        }
    }

    function retry() {
        setNotifications(null)
        setError('')
        setRetryCount((count) => count + 1)
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1>Notifications</h1>
                    <p>Updates about your job applications appear here.</p>
                </div>
                <Link to="/applications" className={styles.headerAction}>My Applications</Link>
            </header>

            {actionError && <Alert tone="error">{actionError}</Alert>}
            {error && notifications !== null && <Alert tone="error">{error}</Alert>}
            <Card className={styles.card}>
                {notifications === null ? (
                    error ? (
                        <div className={styles.message}>
                            <Alert tone="error">{error}</Alert>
                            <button type="button" onClick={retry}>
                                Retry
                            </button>
                        </div>
                    ) : (
                        <p className={styles.message} role="status">Loading notifications…</p>
                    )
                ) : notifications.length === 0 ? (
                    <EmptyState title="You're all caught up">
                        Application status updates will show here when they arrive.
                    </EmptyState>
                ) : (
                    <ul className={styles.list}>
                        {notifications.map((notification, notificationIndex) => (
                            <li
                                key={`${notification.id}-${notificationIndex}`}
                                className={`${styles.item} ${notification.is_read ? '' : styles.unread}`}
                            >
                                <span className={styles.indicator} aria-hidden="true" />
                                <div className={styles.content}>
                                    <div className={styles.titleRow}>
                                        <h2>{notification.title}</h2>
                                        <time dateTime={notification.created_at}>
                                            {timeAgo(notification.created_at)}
                                        </time>
                                    </div>
                                    <p>{notification.message}</p>
                                    <div className={styles.actions}>
                                        {notification.application_id && (
                                            notification.type?.startsWith('interview') ? (
                                                <Link to={`/applications/${encodeURIComponent(notification.application_id)}/interview`}>
                                                    Open interview page
                                                </Link>
                                            ) : (
                                                <Link to={`/applications?highlight=${encodeURIComponent(notification.application_id)}`}>
                                                    View Application
                                                </Link>
                                            )
                                        )}
                                        {!notification.is_read && (
                                            <button
                                                type="button"
                                                onClick={() => markAsRead(notification.id)}
                                            >
                                                Mark as read
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            className={styles.deleteAction}
                                            aria-label={`Delete notification: ${notification.title}`}
                                            onClick={() => removeNotification(notification.id)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </div>
    )
}
