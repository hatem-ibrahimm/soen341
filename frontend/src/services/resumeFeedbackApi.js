import { request, USE_MOCK_API } from './apiClient.js'
import { getUserId } from './session.js'
import { delay } from './mockStore.js'

// AI-Powered Resume Feedback (Sprint 3 start, finished in Sprint 4).
//
// Backend route (Ariana's branch feature/Sprint3/Ariana/ai-resume-feedback):
//   GET  /api/profiles/<userId>/resume/feedback
//     200 -> { feedback: null | { resume_id, strengths, areas_for_improvement, recommendations, generated_at } }
//   POST /api/profiles/<userId>/resume/feedback      (no body)
//     200 -> { resume_id, strengths, areas_for_improvement, recommendations, generated_at }
//     400 -> { error: "Only PDF and DOCX resumes are supported." | "No readable text found in the resume." }
//     401 / 403 -> not logged in / not your profile
//     404 -> { error: "Resume not found." }
//     500 -> { error: "Unable to analyze resume." }
// It reviews the ONE resume on the user's profile (same as resumeApi.js).

export const NO_RESUME = 'NO_RESUME'
export const NOT_AVAILABLE = 'NOT_AVAILABLE'

function feedbackError(code, message) {
    const error = new Error(message)
    error.code = code
    return error
}

const asList = (value) => (Array.isArray(value) ? value.filter((s) => typeof s === 'string' && s.trim()) : [])

function toFeedback(raw) {
    return {
        resumeId: raw.resume_id ? String(raw.resume_id) : null,
        strengths: asList(raw.strengths),
        improvements: asList(raw.areas_for_improvement),
        recommendations: asList(raw.recommendations),
        reviewedAt: raw.generated_at ?? new Date().toISOString(),
    }
}

// Sample answer for `npm run dev:mock`, written for the demo user's resume.
const MOCK_FEEDBACK = {
    resume_id: 'res-1',
    strengths: [
        'Experience bullets lead with what you built, like rebuilding the ordering page in React.',
        'Cutting load time by 40% is a concrete, measurable result. Recruiters look for exactly this.',
        'The skills list is short and relevant to frontend roles instead of listing every tool you have touched.',
        'Education is easy to find, with your degree and expected graduation year.',
    ],
    areas_for_improvement: [
        'The teaching assistant role lists duties ("ran weekly labs") but not what came out of them.',
        'There is no link to a portfolio or GitHub, which most frontend recruiters will look for.',
        'A few bullet points run past two lines, which makes the page feel dense.',
    ],
    recommendations: [
        'Add one or two personal or school projects with a link to the code or a live demo.',
        'Rewrite the TA bullet around a result, for example how many students you supported or what improved.',
        'Put your GitHub and LinkedIn next to your email at the top.',
        'Trim each bullet to a single line where you can and start it with a strong verb.',
    ],
}

export async function requestResumeFeedback() {
    if (USE_MOCK_API) return toFeedback(await delay(MOCK_FEEDBACK, 2600))

    try {
        const data = await request(`/api/profiles/${getUserId()}/resume/feedback`, { method: 'POST' })
        return toFeedback(data)
    } catch (e) {
        if (/resume not found/i.test(e.message)) {
            throw feedbackError(NO_RESUME, 'Upload a resume on your profile first, then come back here.')
        }
        // Flask answers an unknown route with an HTML 404 page, which apiClient
        // turns into this generic message: the endpoint is not merged/running yet.
        if (/could not be completed/i.test(e.message)) {
            throw feedbackError(
                NOT_AVAILABLE,
                'Resume feedback isn’t switched on in the backend yet. Try again once it’s deployed.',
            )
        }
        throw e
    }
}

export async function getSavedResumeFeedback() {
    if (USE_MOCK_API) return null
    const data = await request(`/api/profiles/${getUserId()}/resume/feedback`)
    return data.feedback ? toFeedback(data.feedback) : null
}

// The last review is kept in this browser so the notes are still there
// when you come back (and so you can tick off suggestions as you go).
const storageKey = () => `cc_resume_feedback_${getUserId() ?? 'anon'}`

export function loadSavedFeedback() {
    try {
        const raw = window.localStorage.getItem(storageKey())
        return raw ? JSON.parse(raw) : null
    } catch {
        return null
    }
}

export function saveFeedback(feedback) {
    try {
        window.localStorage.setItem(storageKey(), JSON.stringify(feedback))
    } catch {
        /* storage blocked or full: the notes still show for this visit */
    }
}
