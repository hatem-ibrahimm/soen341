export function formatDate(iso) {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('en-CA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    })
}

export function timeAgo(iso) {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
    if (days <= 0) return 'today'
    if (days === 1) return 'yesterday'
    if (days < 30) return `${days} days ago`
    return formatDate(iso)
}

export function formatFileSize(bytes) {
    if (!bytes && bytes !== 0) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// Short, readable confirmation number made from the application's id.
// The backend creates the id (a UUID like "3f9c2a71-..."); we show the first
// 8 letters/digits in capitals with a "CC-" prefix, e.g. "CC-3F9C2A71".
export function confirmationNumber(applicationId = '') {
    const chars = String(applicationId).replace(/[^a-z0-9]/gi, '').replace(/^app/i, '')
    return `CC-${chars.slice(0, 8).toUpperCase()}`
}
