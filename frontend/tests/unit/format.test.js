// Unit tests: src/services/format.js
// Small display helpers used across the app (dates, file sizes, confirmation numbers).
import { confirmationNumber, formatDate, formatFileSize, timeAgo } from '../../src/services/format.js'

describe('formatDate', () => {
    test('shows a short readable date', () => {
        expect(formatDate(new Date(2026, 10, 2, 12).toISOString())).toBe('Nov 2, 2026')
    })
    test('returns an empty string when there is no date', () => {
        expect(formatDate('')).toBe('')
        expect(formatDate(null)).toBe('')
    })
})

describe('timeAgo', () => {
    const NOW = new Date(2026, 10, 18, 12, 0, 0)
    const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000).toISOString()
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(NOW)
    })
    afterEach(() => vi.useRealTimers())

    test('says "today" and "yesterday" for recent dates', () => {
        expect(timeAgo(daysAgo(0))).toBe('today')
        expect(timeAgo(daysAgo(1))).toBe('yesterday')
    })
    test('counts days for the last month', () => {
        expect(timeAgo(daysAgo(12))).toBe('12 days ago')
    })
    test('shows the date for anything older than 30 days', () => {
        expect(timeAgo(daysAgo(45))).toBe(formatDate(daysAgo(45)))
    })
})

describe('formatFileSize', () => {
    test('uses B, KB or MB depending on the size', () => {
        expect(formatFileSize(512)).toBe('512 B')
        expect(formatFileSize(180 * 1024)).toBe('180 KB')
        expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB')
    })
    test('shows 0 B for an empty file and nothing when the size is unknown', () => {
        expect(formatFileSize(0)).toBe('0 B')
        expect(formatFileSize(undefined)).toBe('')
    })
})

describe('confirmationNumber', () => {
    test('makes a short code from the application id', () => {
        expect(confirmationNumber('3f9c2a71-1b2c-4d5e-8f90-123456789abc')).toBe('CC-3F9C2A71')
    })
})
