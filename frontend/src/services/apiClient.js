import { getToken } from './session.js'

// Shared HTTP helper used by every *Api.js module.
// In dev, Vite proxies /api to the Flask backend (see vite.config.js).
const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

// Sample-data mode: `npm run dev:mock` (Vite "mock" mode) uses a fake backend
// stored in the browser, so the UI works before the real endpoints exist.
export const USE_MOCK_API =
    import.meta.env.MODE === 'mock' || import.meta.env.VITE_USE_MOCK_API === 'true'

export async function request(path, { method = 'GET', body, formData } = {}) {
    const token = getToken()
    const headers = {}
    if (token) headers.Authorization = `Bearer ${token}`
    if (body && !formData) headers['Content-Type'] = 'application/json'

    let response
    try {
        response = await fetch(`${apiBaseUrl}${path}`, {
            method,
            headers,
            // FormData is used for file uploads (resume, profile picture);
            // the browser sets the multipart Content-Type itself.
            body: formData ?? (body ? JSON.stringify(body) : undefined),
        })
    } catch {
        throw new Error('Unable to reach the server. Please try again later.')
    }

    const text = await response.text()
    let data = {}
    if (text) {
        try {
            data = JSON.parse(text)
        } catch {
            if (response.ok) throw new Error('The server returned an invalid response.')
        }
    }

    if (!response.ok) {
        const message = data.error || data.message || data.detail
        throw new Error(
            typeof message === 'string' ? message : 'The request could not be completed.',
        )
    }
    return data
}
