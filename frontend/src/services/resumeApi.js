import { request, USE_MOCK_API } from './apiClient.js'
import { getUserId } from './session.js'
import { delay, fileToDataUrl, newId, readDb, writeDb } from './mockStore.js'

// Resume management.
// Current backend: ONE resume per user, at /api/profiles/<userId>/resume
//   GET    -> { resume: { id, file_name, file_size, uploaded_at, download_url, ... } }  (404 = none)
//   POST   multipart "resume" -> upload (409 if one already exists)
//   PUT    multipart "resume" -> replace
//   DELETE -> delete
// Sample-data mode (npm run dev:mock) supports several resumes with a default.
// When the backend supports several resumes, change MULTIPLE_RESUMES and the functions below.

export const MULTIPLE_RESUMES = USE_MOCK_API

export const ALLOWED_RESUME_TYPES = ['application/pdf', 'application/msword']
export const RESUME_ACCEPT = '.pdf,.doc'
export const MAX_RESUME_BYTES = 5 * 1024 * 1024

export function validateResumeFile(file) {
    if (!file) return 'Please choose a file.'
    const okType = ALLOWED_RESUME_TYPES.includes(file.type) || /\.(pdf|doc)$/i.test(file.name)
    if (!okType) return 'Resumes must be a PDF or DOC file.'
    if (file.size > MAX_RESUME_BYTES) return 'Resumes must be 5 MB or smaller.'
    return ''
}

const resumePath = () => `/api/profiles/${getUserId()}/resume`

// Backend resume -> the shape our pages use.
function toResume(raw) {
    return {
        id: String(raw.id),
        file_name: raw.file_name,
        file_size: raw.file_size,
        uploaded_at: raw.uploaded_at,
        is_default: true, // only one resume, so it is always the one used
        file_url: raw.download_url ?? '',
    }
}

function sendFile(method, file) {
    const formData = new FormData()
    formData.append('resume', file)
    return request(resumePath(), { method, formData })
}

export async function listResumes() {
    if (USE_MOCK_API) return delay(readDb().resumes)
    try {
        const data = await request(resumePath())
        return [toResume(data.resume)]
    } catch (e) {
        if (/not found/i.test(e.message)) return [] // no resume uploaded yet
        throw e
    }
}

export async function uploadResume(file) {
    if (USE_MOCK_API) {
        const db = readDb()
        const resume = {
            id: newId('res'),
            file_name: file.name,
            file_size: file.size,
            uploaded_at: new Date().toISOString(),
            is_default: db.resumes.length === 0,
            file_url: await fileToDataUrl(file),
        }
        db.resumes.unshift(resume)
        writeDb(db)
        return delay(resume)
    }
    try {
        await sendFile('POST', file)
    } catch (e) {
        if (/already exists/i.test(e.message)) {
            throw new Error('You already have a resume. Use Replace to change it.')
        }
        throw e
    }
    const [resume] = await listResumes() // reload to get the download link
    return resume
}

export async function replaceResume(id, file) {
    if (USE_MOCK_API) {
        const db = readDb()
        const url = await fileToDataUrl(file)
        db.resumes = db.resumes.map((r) =>
            r.id === id
                ? { ...r, file_name: file.name, file_size: file.size, uploaded_at: new Date().toISOString(), file_url: url }
                : r,
        )
        writeDb(db)
        return delay(db.resumes.find((r) => r.id === id))
    }
    await sendFile('PUT', file)
    const [resume] = await listResumes()
    return resume
}

export async function setDefaultResume(id) {
    if (USE_MOCK_API) {
        const db = readDb()
        db.resumes = db.resumes.map((r) => ({ ...r, is_default: r.id === id }))
        writeDb(db)
        return delay(db.resumes)
    }
    return listResumes() // one resume: it is already the default
}

export async function deleteResume(id) {
    if (USE_MOCK_API) {
        const db = readDb()
        const wasDefault = db.resumes.find((r) => r.id === id)?.is_default
        db.resumes = db.resumes.filter((r) => r.id !== id)
        if (wasDefault && db.resumes[0]) db.resumes[0].is_default = true
        writeDb(db)
        return delay(db.resumes)
    }
    await request(resumePath(), { method: 'DELETE' })
    return []
}
