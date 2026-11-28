import { request, USE_MOCK_API } from './apiClient.js'
import { toJob } from './jobsApi.js'
import { delay, readDb } from './mockStore.js'
import { getUserId } from './session.js'

// AI Job Matching Suggestions (Sprint 4).
// "Recommend relevant jobs based on user profiles and resumes."
//
// Backend route (backend/src/main/ai_job_matching.py):
//   POST /api/profiles/<userId>/job-matches      (no body)
//     200 -> {
//       recommendations: [{
//         job_id, match_score (0-100), matching_skills: [], missing_skills: [],
//         explanation, job: { id, title, company_name, location, category, description, required_skills }
//       }],                                   // at most 5, best first
//       resume_used: bool, jobs_analyzed: int, warnings: [string]
//     }
//     200 -> { recommendations: [], message: "No available job postings found.", warnings: [] }
//     400 -> { error: "Add information to your profile or upload a resume before generating job matches." }
//     401 / 403 / 404 -> not logged in / not your profile / profile not found
//     502 -> AI sent back something invalid      503 -> AI unavailable      500 -> anything else

export const NEEDS_PROFILE = 'NEEDS_PROFILE'
export const NOT_AVAILABLE = 'NOT_AVAILABLE'
export const AI_BUSY = 'AI_BUSY'

const asList = (value) =>
    Array.isArray(value) ? value.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()) : []

// Turn the backend answer into what the page uses. Exported for unit tests.
export function toMatchResult(data = {}) {
    const recommendations = Array.isArray(data.recommendations) ? data.recommendations : []
    const matches = recommendations
        .filter((r) => r && r.job)
        .map((r) => ({
            jobId: String(r.job_id ?? r.job.id),
            score: Math.max(0, Math.min(100, Math.round(Number(r.match_score) || 0))),
            matchingSkills: asList(r.matching_skills),
            missingSkills: asList(r.missing_skills),
            explanation: typeof r.explanation === 'string' ? r.explanation.trim() : '',
            job: toJob(r.job),
        }))
        .sort((a, b) => b.score - a.score)

    return {
        matches,
        resumeUsed: Boolean(data.resume_used),
        jobsAnalyzed: Number.isFinite(data.jobs_analyzed) ? data.jobs_analyzed : null,
        warnings: asList(data.warnings),
        message: typeof data.message === 'string' ? data.message : '',
        generatedAt: new Date().toISOString(),
    }
}

// How a score is described in words. Exported for unit tests.
export function scoreBand(score) {
    if (score >= 80) return { label: 'Strong match', tone: 'strong' }
    if (score >= 60) return { label: 'Good match', tone: 'good' }
    return { label: 'Worth a look', tone: 'fair' }
}

// Skills the AI flagged as missing, counted across every match, most common first.
export function skillGaps(matches) {
    const counts = new Map()
    for (const match of matches) {
        for (const skill of new Set(match.missingSkills.map((s) => s.toLowerCase()))) {
            const original = match.missingSkills.find((s) => s.toLowerCase() === skill)
            const entry = counts.get(skill) ?? { skill: original, count: 0 }
            entry.count += 1
            counts.set(skill, entry)
        }
    }
    return [...counts.values()].sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill))
}

function matchError(code, message) {
    const error = new Error(message)
    error.code = code
    return error
}

// Give backend errors a code the page can react to. Exported for unit tests.
export function explainError(error) {
    const message = error?.message ?? ''
    if (/add information to your profile/i.test(message)) {
        return matchError(NEEDS_PROFILE, 'Add a few skills or some experience to your profile (or upload a resume) so there is something to match on.')
    }
    if (/temporarily unavailable|invalid ai recommendations/i.test(message)) {
        return matchError(AI_BUSY, 'The matching assistant had a hiccup. Give it a moment and try again.')
    }
    // Flask answers an unknown route with an HTML 404 page, which apiClient turns
    // into this generic message: the endpoint is not merged / running yet.
    if (/could not be completed/i.test(message)) {
        return matchError(NOT_AVAILABLE, 'Job matching isn’t switched on in the backend yet. Try again once it’s deployed.')
    }
    return error
}

// ---------- Sample-data mode (`npm run dev:mock` and the tests) ----------

const MOCK_PICKS = [
    {
        job_id: 'job-101',
        match_score: 91,
        matching_skills: ['React', 'JavaScript', 'Git'],
        missing_skills: ['TypeScript'],
        explanation:
            'Your internship rebuilding an ordering page in React lines up closely with building accessible React dashboards here, and you are looking for a junior frontend role in Montréal.',
    },
    {
        job_id: 'job-106',
        match_score: 84,
        matching_skills: ['React', 'JavaScript'],
        missing_skills: ['TypeScript', 'Pair programming'],
        explanation:
            'An internship on a React admin in Montréal fits your goal of a winter internship and your frontend experience.',
    },
    {
        job_id: 'job-113',
        match_score: 76,
        matching_skills: ['React', 'JavaScript'],
        missing_skills: ['Screen reader testing', 'WCAG'],
        explanation:
            'Your bio mentions accessible web apps, which is the focus of this role. Hands-on accessibility testing would make you a stronger fit.',
    },
    {
        job_id: 'job-107',
        match_score: 68,
        matching_skills: ['React', 'SQL'],
        missing_skills: ['Data visualization', 'TypeScript'],
        explanation:
            'You have the React and SQL basics for reporting screens. Charting libraries would be new ground.',
    },
    {
        job_id: 'job-105',
        match_score: 52,
        matching_skills: ['Figma'],
        missing_skills: ['User research', 'Prototyping'],
        explanation:
            'You list Figma, but your experience is mostly development. This one is a stretch if you want to move toward design.',
    },
]

function mockMatches() {
    const db = readDb()
    const { profile = {}, skills = [], experiences = [], education = [], resumes = [] } = db
    const hasProfile = Boolean(profile.title || profile.bio || skills.length || experiences.length || education.length)
    const hasResume = resumes.length > 0

    if (!hasProfile && !hasResume) {
        throw new Error('Add information to your profile or upload a resume before generating job matches.')
    }

    const jobs = (db.jobs ?? []).filter((job) => !job.status || job.status === 'published')
    const byId = new Map(jobs.map((job) => [String(job.id), job]))
    return {
        recommendations: MOCK_PICKS.filter((p) => byId.has(p.job_id)).map((p) => {
            const job = byId.get(p.job_id)
            return { ...p, job: { ...job, company_name: job.company_name ?? job.company, created_at: job.posted_at } }
        }),
        resume_used: hasResume,
        jobs_analyzed: jobs.length,
        warnings: hasResume ? [] : ['No resume uploaded. Recommendations are based on your profile.'],
    }
}

// ---------- Calls ----------

export async function requestJobMatches() {
    if (USE_MOCK_API) {
        try {
            return toMatchResult(await delay(mockMatches(), 2400))
        } catch (e) {
            throw explainError(e)
        }
    }
    try {
        const data = await request(`/api/profiles/${encodeURIComponent(getUserId())}/job-matches`, { method: 'POST' })
        return toMatchResult(data)
    } catch (e) {
        throw explainError(e)
    }
}

// The last set of matches is kept in this browser, so the page is not empty when
// you come back (each run calls the AI, so it is not re-run on every visit).
const storageKey = () => `cc_job_matches_${getUserId() ?? 'anon'}`

export function loadSavedMatches() {
    try {
        const raw = window.localStorage.getItem(storageKey())
        return raw ? JSON.parse(raw) : null
    } catch {
        return null
    }
}

export function saveMatches(result) {
    try {
        window.localStorage.setItem(storageKey(), JSON.stringify(result))
    } catch {
        /* storage blocked or full: results still show for this visit */
    }
}
