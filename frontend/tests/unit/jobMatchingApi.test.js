// Unit tests: the small helpers behind AI job matching (src/services/jobMatchingApi.js).
// These check one function at a time, with no page rendered. They use the exact
// response shape the backend sends (backend/src/main/ai_job_matching.py).
import {
    AI_BUSY,
    explainError,
    NEEDS_PROFILE,
    NOT_AVAILABLE,
    scoreBand,
    skillGaps,
    toMatchResult,
} from '../../src/services/jobMatchingApi.js'

const backendResponse = {
    recommendations: [
        {
            job_id: 7,
            match_score: 64,
            matching_skills: ['SQL '],
            missing_skills: ['Tableau', ''],
            explanation: '  Good SQL background.  ',
            job: { id: 7, title: 'Data Analyst', company_name: 'Riverbank', location: 'Toronto', category: 'Data', required_skills: ['SQL'] },
        },
        {
            job_id: 3,
            match_score: 88,
            matching_skills: ['React'],
            missing_skills: [],
            explanation: 'Strong React fit.',
            job: { id: 3, title: 'Frontend Dev', company_name: 'Northwind', location: 'Montréal', category: 'Software', required_skills: [] },
        },
    ],
    resume_used: true,
    jobs_analyzed: 12,
    warnings: [],
}

describe('toMatchResult', () => {
    test('maps the backend response and sorts best match first', () => {
        const result = toMatchResult(backendResponse)
        expect(result.matches.map((m) => m.jobId)).toEqual(['3', '7'])
        expect(result.matches[0].job).toMatchObject({ id: '3', title: 'Frontend Dev', company_name: 'Northwind' })
        expect(result.resumeUsed).toBe(true)
        expect(result.jobsAnalyzed).toBe(12)
    })

    test('trims text and drops empty skills', () => {
        const analyst = toMatchResult(backendResponse).matches[1]
        expect(analyst.matchingSkills).toEqual(['SQL'])
        expect(analyst.missingSkills).toEqual(['Tableau'])
        expect(analyst.explanation).toBe('Good SQL background.')
    })

    test('handles the "no jobs posted" answer', () => {
        const result = toMatchResult({ recommendations: [], message: 'No available job postings found.', warnings: [] })
        expect(result.matches).toEqual([])
        expect(result.message).toBe('No available job postings found.')
        expect(result.jobsAnalyzed).toBeNull()
    })

    test('keeps scores between 0 and 100 and skips entries without a job', () => {
        const result = toMatchResult({
            recommendations: [
                { job_id: 1, match_score: 140, matching_skills: [], missing_skills: [], explanation: 'x', job: { id: 1 } },
                { job_id: 2, match_score: 50, matching_skills: [], missing_skills: [], explanation: 'y' },
            ],
        })
        expect(result.matches).toHaveLength(1)
        expect(result.matches[0].score).toBe(100)
    })
})

describe('scoreBand', () => {
    test.each([
        [100, 'Strong match'],
        [80, 'Strong match'],
        [79, 'Good match'],
        [60, 'Good match'],
        [59, 'Worth a look'],
        [0, 'Worth a look'],
    ])('%i is "%s"', (score, label) => {
        expect(scoreBand(score).label).toBe(label)
    })
})

describe('skillGaps', () => {
    test('counts each missing skill once per job, ignoring case', () => {
        const gaps = skillGaps([
            { missingSkills: ['TypeScript', 'typescript'] },
            { missingSkills: ['TypeScript', 'Docker'] },
            { missingSkills: [] },
        ])
        expect(gaps).toEqual([
            { skill: 'TypeScript', count: 2 },
            { skill: 'Docker', count: 1 },
        ])
    })
})

describe('explainError', () => {
    test.each([
        ['Add information to your profile or upload a resume before generating job matches.', NEEDS_PROFILE],
        ['AI job matching is temporarily unavailable. Please try again later.', AI_BUSY],
        ['Invalid AI recommendations received. Please try again.', AI_BUSY],
        ['The request could not be completed.', NOT_AVAILABLE],
    ])('"%s" becomes %s', (message, code) => {
        expect(explainError(new Error(message)).code).toBe(code)
    })

    test('other errors are passed through unchanged', () => {
        const error = new Error('Access denied.')
        expect(explainError(error)).toBe(error)
    })
})
