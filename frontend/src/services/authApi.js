const apiBaseUrl = (
    import.meta.env.VITE_API_URL || ''
).replace(/\/+$/, '')

export async function request(
    path,
    {
        method = 'GET',
        body,
        signal,
    } = {},
) {
    const token = window.localStorage.getItem('token')
    const hasBody = body !== undefined

    // Serialize outside the transport catch so programming errors
    // are not incorrectly reported as connection failures.
    const requestBody = hasBody
        ? JSON.stringify(body)
        : undefined

    let response
    let responseText

    try {
        response = await fetch(`${apiBaseUrl}${path}`, {
            method,
            signal,
            headers: {
                ...(hasBody
                    ? { 'Content-Type': 'application/json' }
                    : {}),
                ...(token
                    ? { Authorization: `Bearer ${token}` }
                    : {}),
            },
            body: requestBody,
        })

        responseText = await response.text()
    } catch (error) {
        if (signal?.aborted || error?.name === 'AbortError') {
            throw error
        }

        throw new Error(
            'Unable to reach the server. Please try again later.',
        )
    }

    let responseBody = {}
    let invalidJson = false

    if (responseText.trim()) {
        try {
            responseBody = JSON.parse(responseText)
        } catch {
            invalidJson = true
        }
    }

    if (!response.ok) {
        const fallbackMessage =
            response.status === 401
                ? 'Authentication failed or your session expired. Please sign in again.'
                : 'The request could not be completed. Please try again.'

        const candidates = [
            responseBody?.message,
            responseBody?.error,
            responseBody?.detail,
        ]

        const message = candidates.find(
            (value) =>
                typeof value === 'string' &&
                value.trim().length > 0,
        )

        const error = new Error(message || fallbackMessage)
        error.status = response.status

        throw error
    }

    if (invalidJson) {
        throw new Error(
            'The server returned an invalid response.',
        )
    }

    return responseBody
}

export function register(user) {
    return request('/api/auth/register', {
        method: 'POST',
        body: {
            email: user.email,
            password: user.password,
            first_name: user.firstName,
            last_name: user.lastName,
        },
    })
}

export function login(credentials) {
    return request('/api/auth/login', {
        method: 'POST',
        body: credentials,
    })
}

export function getProfile(profileId) {
    return request(`/api/profiles/${encodeURIComponent(profileId)}`)
}
function getStoredProfileId() {
    const userId = window.localStorage.getItem('userId')

    if (!userId) {
        throw new Error(
            'Please log in to access your profile.',
        )
    }

export function saveProfile(profileId, profile) {
    return request(`/api/profiles/${encodeURIComponent(profileId)}`, {
        method: 'PUT',
        body: profile,
    })
    return encodeURIComponent(userId)
}

export function getProfile({ signal } = {}) {
    return request(
        `/api/profiles/${getStoredProfileId()}`,
        { signal },
    )
}

export function saveProfile(
    profile,
    { signal } = {},
) {
    return request(
        `/api/profiles/${getStoredProfileId()}`,
        {
            method: 'PUT',
            body: profile,
            signal,
        },
    )
}
}