import { request, USE_MOCK_API } from './apiClient.js'
import { delay, readDb, writeDb } from './mockStore.js'

function listMockNotifications() {
    const db = readDb()
    const deletedIds = new Set(db.deleted_notifications ?? [])
    const readById = new Map(
        (db.notifications ?? []).map((notification) => [notification.id, notification.is_read]),
    )

    const statusNotifications = (db.applications ?? [])
        .flatMap((application, applicationIndex) =>
            (application.status_history ?? []).slice(1).map((update, index) => {
                const id = `mock-notification-${applicationIndex}-${application.id}-${index}-${update.changed_at}`
                return {
                    id,
                    application_id: String(application.id),
                    type: 'application_status',
                    title: 'Application Status Updated',
                    message: `Your application status has changed to ${update.status}.`,
                    is_read: Boolean(readById.get(id)),
                    created_at: update.changed_at,
                }
            }),
        )
        .filter((notification) => !deletedIds.has(notification.id))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    const eventNotifications = (db.notifications ?? [])
        .filter((notification) => !deletedIds.has(notification.id))
        .map((notification) => ({
        ...notification,
        application_id: notification.application_id
            ? String(notification.application_id)
            : null,
        is_read: Boolean(readById.get(notification.id) ?? notification.is_read),
    }))
    return [...statusNotifications, ...eventNotifications]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

export async function listNotifications() {
    if (USE_MOCK_API) return delay(listMockNotifications())
    const data = await request('/api/notifications')
    return data.notifications ?? []
}

export async function getUnreadNotificationCount() {
    if (USE_MOCK_API) {
        return delay(listMockNotifications().filter((notification) => !notification.is_read).length)
    }
    const data = await request('/api/notifications/unread-count')
    return data.unread_count
}

export async function markNotificationRead(notificationId) {
    if (USE_MOCK_API) {
        const db = readDb()
        db.notifications ??= []
        const notification = db.notifications.find((item) => item.id === notificationId)
        if (notification) notification.is_read = true
        else db.notifications.push({ id: notificationId, is_read: true })
        writeDb(db)
        return
    }
    await request(`/api/notifications/${encodeURIComponent(notificationId)}/read`, {
        method: 'PATCH',
    })
}

export async function deleteNotification(notificationId) {
    if (USE_MOCK_API) {
        const db = readDb()
        db.deleted_notifications ??= []
        if (!db.deleted_notifications.includes(notificationId)) {
            db.deleted_notifications.push(notificationId)
        }
        db.notifications = (db.notifications ?? []).filter(
            (notification) => notification.id !== notificationId,
        )
        writeDb(db)
        return
    }
    await request(`/api/notifications/${encodeURIComponent(notificationId)}`, {
        method: 'DELETE',
    })
}
