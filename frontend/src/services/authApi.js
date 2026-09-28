const apiBaseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(
    /\/+$/,
    '',
)

async function post(path, body) {
    let response
    try {
        response = await fetch(`${apiBaseUrl}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
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
    return post('/api/auth/register', user)
}

export function login(credentials) {
    return post('/api/auth/login', credentials)
}