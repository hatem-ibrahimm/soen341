// Unit tests: src/services/jobsApi.js
// toJob() turns a job from the backend into the shape our pages use.
import { toJob } from '../../src/services/jobsApi.js'

const backendJob = {
    id: 7,
    title: 'Frontend Developer',
    company_name: 'Larkspur Commerce',
    location: 'Montréal, QC',
    category: 'Engineering',
    description: 'React and TypeScript work.',
    min_salary: 60000,
    max_salary: 75000,
    created_at: '2026-11-16T18:58:20Z',
}

describe('toJob', () => {
    test('renames the backend fields to the ones the pages use', () => {
        const job = toJob(backendJob)
        expect(job).toMatchObject({
            id: '7',
            title: 'Frontend Developer',
            company: 'Larkspur Commerce',
            company_name: 'Larkspur Commerce',
            category: 'Engineering',
            type: 'Engineering',
            posted_at: '2026-11-16T18:58:20Z',
            required_skills: [],
        })
    })
    test('formats the salary range', () => {
        expect(toJob(backendJob).salary).toBe('$60,000 – $75,000')
        expect(toJob({ ...backendJob, max_salary: null }).salary).toBe('From $60,000')
        expect(toJob({ ...backendJob, min_salary: null }).salary).toBe('Up to $75,000')
    })
    test('leaves the salary empty when the backend has none', () => {
        expect(toJob({ ...backendJob, min_salary: null, max_salary: null }).salary).toBe('')
    })
    test('returns null when there is no job', () => {
        expect(toJob(null)).toBeNull()
    })
})
