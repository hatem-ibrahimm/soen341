// Unit tests: src/features/analytics/analyticsMath.js
// The calculations behind the Application Analytics and History Dashboard.
import {
    daysBetween,
    groupByMonth,
    plural,
    startOfWeek,
    summarize,
    weeklyCounts,
} from '../../src/features/analytics/analyticsMath.js'

// "Today" is frozen at Wednesday, November 18, 2026, noon (local time),
// so the results never depend on the day the tests run.
const NOW = new Date(2026, 10, 18, 12, 0, 0)
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000).toISOString()
const app = (id, status, sentDaysAgo) => ({ id, status, applied_at: daysAgo(sentDaysAgo) })

beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

describe('plural', () => {
    test('uses the singular for exactly one', () => {
        expect(plural(1, 'application')).toBe('1 application')
    })
    test('adds an "s" for zero and for more than one', () => {
        expect(plural(0, 'application')).toBe('0 applications')
        expect(plural(5, 'day')).toBe('5 days')
    })
})

describe('daysBetween', () => {
    test('counts whole days between a date and now', () => {
        expect(daysBetween(daysAgo(3))).toBe(3)
        expect(daysBetween(daysAgo(0))).toBe(0)
    })
    test('never returns a negative number for a future date', () => {
        expect(daysBetween(daysAgo(-2))).toBe(0)
    })
})

describe('startOfWeek', () => {
    test('returns the Monday at midnight of the same week', () => {
        const monday = startOfWeek(NOW) // NOW is a Wednesday
        expect(monday.getDay()).toBe(1)
        expect(monday.getDate()).toBe(16)
        expect([monday.getHours(), monday.getMinutes()]).toEqual([0, 0])
    })
    test('treats Sunday as the last day of the week, not the first', () => {
        const sunday = new Date(2026, 10, 22, 18, 0)
        expect(startOfWeek(sunday).getDate()).toBe(16)
    })
})

describe('weeklyCounts', () => {
    test('returns one bucket per week, ending with the current week', () => {
        const weeks = weeklyCounts([], 12)
        expect(weeks).toHaveLength(12)
        expect(weeks[11].start.getTime()).toBe(startOfWeek(NOW).getTime())
        expect(weeks.every((w) => w.count === 0)).toBe(true)
    })
    test('counts each application in the week it was sent', () => {
        const weeks = weeklyCounts([
            app('a', 'Applied', 0), // this week (Wed)
            app('b', 'Applied', 2), // this week (Mon)
            app('c', 'Applied', 3), // last week (Sun)
            app('d', 'Applied', 9), // last week (Mon)
            app('e', 'Applied', 15), // two weeks ago
        ], 4)

        expect(weeks.map((w) => w.count)).toEqual([0, 1, 2, 2])
        expect(weeks[3].apps.map((a) => a.id)).toEqual(['a', 'b'])
    })
    test('ignores applications older than the time range', () => {
        const weeks = weeklyCounts([app('old', 'Applied', 100)], 8)
        expect(weeks.reduce((sum, w) => sum + w.count, 0)).toBe(0)
    })
})

describe('groupByMonth', () => {
    test('groups by month, newest month first, newest application first', () => {
        const groups = groupByMonth([
            { id: 'oct', applied_at: new Date(2026, 9, 10).toISOString() },
            { id: 'nov-early', applied_at: new Date(2026, 10, 2).toISOString() },
            { id: 'nov-late', applied_at: new Date(2026, 10, 15).toISOString() },
        ])

        expect(groups.map((g) => g.label)).toEqual(['November 2026', 'October 2026'])
        expect(groups[0].apps.map((a) => a.id)).toEqual(['nov-late', 'nov-early'])
        expect(groups[1].apps.map((a) => a.id)).toEqual(['oct'])
    })
    test('returns an empty list when there are no applications', () => {
        expect(groupByMonth([])).toEqual([])
    })
})

describe('summarize', () => {
    const applications = [
        app('1', 'Applied', 1),
        app('2', 'Applied', 20),
        app('3', 'Interview', 7),
        app('4', 'Rejected', 13),
    ]
    const byStatus = { Applied: 2, 'Under Review': 0, Interview: 1, Offered: 0, Rejected: 1 }

    test('a reply is anything that moved past "Applied", rejections included', () => {
        const result = summarize(applications, byStatus, 4)
        expect(result.heardBack).toBe(2)
        expect(result.responseRate).toBe(50)
    })
    test('the usual pace is applications per week since the first one', () => {
        // first application 20 days ago -> 3 weeks (rounded up) -> 4 / 3
        expect(summarize(applications, byStatus, 4).perWeek).toBeCloseTo(4 / 3)
    })
    test('"waiting longest" is the oldest application still at "Applied"', () => {
        const { longestWait } = summarize(applications, byStatus, 4)
        expect(longestWait.app.id).toBe('2')
        expect(longestWait.days).toBe(20)
    })
    test('counts applications sent this week and last week', () => {
        const result = summarize(applications, byStatus, 4)
        expect(result.thisWeek).toBe(1) // 1 day ago
        expect(result.lastWeek).toBe(1) // 7 days ago = last Wednesday
    })
    test('active applications are Applied + Under Review + Interview', () => {
        expect(summarize(applications, byStatus, 4).active).toBe(3)
    })
    test('handles a job seeker with no applications', () => {
        const empty = { Applied: 0, 'Under Review': 0, Interview: 0, Offered: 0, Rejected: 0 }
        const result = summarize([], empty, 0)
        expect(result.responseRate).toBe(0)
        expect(result.longestWait).toBeNull()
        expect(result.first).toBeNull()
    })
})
