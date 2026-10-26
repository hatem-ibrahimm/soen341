// One place to read/write the logged-in user's session.
// LoginForm saves "token" and "userId" — everything else reads them from here
// (Sprint 1 bug: ProfileManagement read "accessToken" while login saved "token").

const TOKEN_KEY = 'token'
const USER_ID_KEY = 'userId'

// localStorage can throw (private mode, blocked storage), so keep a memory fallback.
const memory = {}
function read(key) {
    try {
        return window.localStorage.getItem(key) ?? memory[key] ?? null
    } catch {
        return memory[key] ?? null
    }
}
function write(key, value) {
    memory[key] = value
    try {
        if (value === null) window.localStorage.removeItem(key)
        else window.localStorage.setItem(key, value)
    } catch {
        /* memory fallback already updated */
    }
}

export const getToken = () => read(TOKEN_KEY)
export const getUserId = () => read(USER_ID_KEY)
export const isLoggedIn = () => Boolean(getToken())

export function saveSession(token, userId) {
    write(TOKEN_KEY, token)
    if (userId) write(USER_ID_KEY, userId)
}

export function clearSession() {
    write(TOKEN_KEY, null)
    write(USER_ID_KEY, null)
    delete memory[TOKEN_KEY]
    delete memory[USER_ID_KEY]
}
