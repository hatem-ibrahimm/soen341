// Small helpers that turn a list of applications into dashboard numbers.
// Kept separate from the components so they are easy to read and test.

const DAY = 86400000

export function daysBetween(fromIso, to = Date.now()) {
    return Math.max(0, Math.floor((to - new Date(fromIso).getTime()) / DAY))
}

// Monday 00:00 of the week that contains `date` (local time).
export function startOfWeek(date) {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    const shift = (d.getDay() + 6) % 7 // Monday = 0
    d.setDate(d.getDate() - shift)
    return d
}

// Applications submitted per week, oldest week first, ending with this week.
// Returns [{ start: Date, count, apps }]
export function weeklyCounts(applications, weeks = 12) {
    const thisWeek = startOfWeek(new Date())
    const buckets = []
    for (let i = weeks - 1; i >= 0; i--) {
        const start = new Date(thisWeek)
        start.setDate(start.getDate() - i * 7)
        buckets.push({ start, count: 0, apps: [] })
    }
    const first = buckets[0].start.getTime()
    for (const app of applications) {
        const t = new Date(app.applied_at).getTime()
        if (Number.isNaN(t) || t < first) continue
        const index = Math.min(buckets.length - 1, Math.floor((t - first) / (7 * DAY)))
        buckets[index].count += 1
        buckets[index].apps.push(app)
    }
    return buckets
}

// Group applications by month for the history list, newest month first.
export function groupByMonth(applications) {
    const groups = new Map()
    for (const app of applications) {
        const d = new Date(app.applied_at)
        const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`
        if (!groups.has(key)) {
            groups.set(key, {
                key,
                label: d.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }),
                apps: [],
            })
        }
        groups.get(key).apps.push(app)
    }
    return [...groups.values()]
        .sort((a, b) => b.key.localeCompare(a.key))
        .map((g) => ({ ...g, apps: g.apps.sort((a, b) => b.applied_at.localeCompare(a.applied_at)) }))
}

// The handful of facts shown at the top of the dashboard.
export function summarize(applications, byStatus, total) {
    const sorted = [...applications].sort((a, b) => a.applied_at.localeCompare(b.applied_at))
    const first = sorted[0]?.applied_at ?? null

    // "Heard back" = anything that moved past Applied, including a rejection.
    const heardBack = total - (byStatus.Applied ?? 0)
    const responseRate = total ? Math.round((heardBack / total) * 100) : 0

    const weeksActive = first ? Math.max(1, Math.ceil(daysBetween(first) / 7)) : 1
    const perWeek = total / weeksActive

    const stillWaiting = sorted.filter((a) => a.status === 'Applied')
    const longestWait = stillWaiting[0]
        ? { app: stillWaiting[0], days: daysBetween(stillWaiting[0].applied_at) }
        : null

    const weeks = weeklyCounts(applications, 2)
    const thisWeek = weeks[1].count
    const lastWeek = weeks[0].count

    const active = (byStatus.Applied ?? 0) + (byStatus['Under Review'] ?? 0) + (byStatus.Interview ?? 0)

    return { first, heardBack, responseRate, perWeek, longestWait, thisWeek, lastWeek, active }
}

// "1 application" / "3 applications"
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
