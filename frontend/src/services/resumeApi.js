import { request, USE_MOCK_API } from './apiClient.js'
import { delay, fileToDataUrl, newId, readDb, writeDb } from './mockStore.js'

// Resume management. Backend routes:
//   GET    /api/resumes               -> { resumes: [...] }   (current user's)
//   POST   /api/resumes               multipart "file"       -> { resume }
//   PUT    /api/resumes/<id>/file     multipart "file"       -> { resume }  (replace)
//   PATCH  /api/resumes/<id>          { is_default: true }   -> { resume }
//   DELETE /api/resumes/<id>
// resume = { id, file_name, file_size, uploaded_at, is_default, file_url }

export const ALLOWED_RESUME_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
export const MAX_RESUME_BYTES = 5 * 1024 * 1024

export function validateResumeFile(file) {
    if (!file) return 'Please choose a file.'
    const okType =
        ALLOWED_RESUME_TYPES.includes(file.type) || /\.(pdf|docx?)$/i.test(file.name)
    if (!okType) return 'Resumes must be a PDF or Word document.'
    if (file.size > MAX_RESUME_BYTES) return 'Resumes must be 5 MB or smaller.'
    return ''
}

export async function listResumes() {
    if (USE_MOCK_API) return delay(readDb().resumes)
    const data = await request('/api/resumes')
    return data.resumes
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
    const formData = new FormData()
    formData.append('file', file)
    const data = await request('/api/resumes', { method: 'POST', formData })
    return data.resume
}

export async function replaceResume(id, file) {
    if (USE_MOCK_API) {
        const db = readDb()
        const url = await fileToDataUrl(file)
        db.resumes = db.resumes.map((r) =>
            r.id === id
                ? {
                      ...r,
                      file_name: file.name,
                      file_size: file.size,
                      uploaded_at: new Date().toISOString(),
                      file_url: url,
                  }
                : r,
        )
        writeDb(db)
        return delay(db.resumes.find((r) => r.id === id))
    }
    const formData = new FormData()
    formData.append('file', file)
    const data = await request(`/api/resumes/${id}/file`, { method: 'PUT', formData })
    return data.resume
}

export async function setDefaultResume(id) {
    if (USE_MOCK_API) {
        const db = readDb()
        db.resumes = db.resumes.map((r) => ({ ...r, is_default: r.id === id }))
        writeDb(db)
        return delay(db.resumes)
    }
    await request(`/api/resumes/${id}`, { method: 'PATCH', body: { is_default: true } })
    return listResumes()
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
    await request(`/api/resumes/${id}`, { method: 'DELETE' })
    return listResumes()
}
