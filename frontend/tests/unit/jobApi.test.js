// Unit tests: src/services/jobApi.js
// Helpers behind the job search filters and salary display.
import {
    createJobSearchParams,
    formatJobSalary,
    readJobFilters,
    validateJobFilters,
} from '../../src/services/jobApi.js'

describe('readJobFilters', () => {
    test('reads every filter from the page address', () => {
        expect(readJobFilters('?keyword=react&location=Montreal&salaryMin=50000')).toEqual({
            keyword: 'react',
            location: 'Montreal',
            category: '',
            salaryMin: '50000',
            salaryMax: '',
        })
    })
    test('returns empty filters when there is nothing in the address', () => {
        expect(readJobFilters('')).toEqual({
            keyword: '', location: '', category: '', salaryMin: '', salaryMax: '',
        })
    })
})

describe('createJobSearchParams', () => {
    test('keeps only filled-in filters and trims spaces', () => {
        const params = createJobSearchParams({ keyword: '  react ', location: '', category: 'Software' })
        expect(params.toString()).toBe('keyword=react&category=Software')
    })
    test('round-trips with readJobFilters', () => {
        const filters = { keyword: 'qa', location: 'Laval', category: '', salaryMin: '40000', salaryMax: '90000' }
        expect(readJobFilters(createJobSearchParams(filters))).toEqual(filters)
    })
})

describe('validateJobFilters', () => {
    test('accepts empty or valid salaries', () => {
        expect(validateJobFilters({})).toEqual({})
        expect(validateJobFilters({ salaryMin: '50000', salaryMax: '80000' })).toEqual({})
        expect(validateJobFilters({ salaryMin: '60000', salaryMax: '60000' })).toEqual({})
    })
    test('rejects negative or non-numeric salaries', () => {
        expect(validateJobFilters({ salaryMin: '-5' })).toHaveProperty('salaryMin')
        expect(validateJobFilters({ salaryMax: 'lots' })).toHaveProperty('salaryMax')
    })
    test('rejects a minimum higher than the maximum', () => {
        expect(validateJobFilters({ salaryMin: '90000', salaryMax: '50000' })).toEqual({
            salaryMax: 'Maximum salary must be greater than or equal to minimum salary.',
        })
    })
})

describe('formatJobSalary', () => {
    test('shows a salary range', () => {
        expect(formatJobSalary({ salary_min: 60000, salary_max: 75000 })).toBe('$60,000–$75,000 / year')
    })
    test('shows "From" or "Up to" when only one end is known', () => {
        expect(formatJobSalary({ salary_min: 50000, salary_max: null })).toBe('From $50,000 / year')
        expect(formatJobSalary({ salary_min: null, salary_max: 90000 })).toBe('Up to $90,000 / year')
    })
    test('says so when no salary is given (missing or null)', () => {
        expect(formatJobSalary({})).toBe('Salary not provided')
        expect(formatJobSalary({ salary_min: null, salary_max: null })).toBe('Salary not provided')
    })
    test('uses a ready-made salary text as is', () => {
        expect(formatJobSalary({ salary: '$28/hr' })).toBe('$28/hr')
    })
})
