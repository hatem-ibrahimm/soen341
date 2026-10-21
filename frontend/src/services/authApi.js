const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

async function request(path, { method = 'GET', body } = {}) {
    let response
    const token = window.localStorage.getItem('token')
    try {
        response = await fetch(`${apiBaseUrl}${path}`, {
            method,
            headers: {
                ...(body ? { 'Content-Type': 'application/json' } : {}),
                ...(token
                    ? { Authorization: 'Bearer ' + token }
                    : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        })
    } catch {
        throw new Error('Unable to reach the server. Please try again later.')
    }

    const responseText = await response.text()
    let responseBody = {}
    if (responseText) {
        try {
            responseBody = JSON.parse(responseText)
        } catch {
            if (response.ok) {
                throw new Error('The server returned an invalid response.')
            }
        }
    }

    if (!response.ok) {
        const message =
            responseBody.message ||
            responseBody.error ||
            responseBody.detail ||
            responseText
        throw new Error(
            typeof message === 'string'
                ? message
                : 'The request could not be completed. Please try again.',
        )
    }

    return responseBody
}

export function register(user) {
    return request('/api/auth/register', { method: 'POST', body: user })
}

export function login(credentials) {
    return request('/api/auth/login', { method: 'POST', body: credentials })
}

export function getProfile() {
    return request('/api/profiles/me')
}

export function saveProfile(profile) {
    return request('/api/profiles/me', { method: 'PUT', body: profile })
}