// Unit tests: src/services/session.js
// Remembers who is logged in (saved in the browser's localStorage).
import {
    clearSession,
    getCompanyName,
    getToken,
    getUserId,
    getUserRole,
    isLoggedIn,
    saveSession,
} from '../../src/services/session.js'

describe('session', () => {
    test('nobody is logged in at first', () => {
        expect(isLoggedIn()).toBe(false)
        expect(getToken()).toBeNull()
    })
    test('saving a session logs the user in and remembers their details', () => {
        saveSession('token-123', 'user-1', 'recruiter', 'Northwind Labs')
        expect(isLoggedIn()).toBe(true)
        expect(getToken()).toBe('token-123')
        expect(getUserId()).toBe('user-1')
        expect(getUserRole()).toBe('recruiter')
        expect(getCompanyName()).toBe('Northwind Labs')
    })
    test('a user is a job seeker unless saved as a recruiter', () => {
        saveSession('token-123', 'user-1')
        expect(getUserRole()).toBe('job_seeker')
    })
    test('clearing the session logs the user out', () => {
        saveSession('token-123', 'user-1', 'recruiter', 'Northwind Labs')
        clearSession()
        expect(isLoggedIn()).toBe(false)
        expect(getUserId()).toBeNull()
        expect(getCompanyName()).toBe('')
    })
})
