// Acceptance tests: Account login
// Users log in with their email and a password that follows the password rules.
import { screen } from '@testing-library/react'
import { vi } from 'vitest'
import { renderApp } from '../renderApp.jsx'

describe('Logging in', () => {
    afterEach(() => vi.restoreAllMocks())

    test('a logged-out visitor is sent to the login page', async () => {
        renderApp('/applications', { loggedIn: false })

        expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Create an account/ })).toBeInTheDocument()
    })

    test('a password that breaks the rules is rejected before contacting the server', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch')
        const { user } = renderApp('/login', { loggedIn: false })

        await user.type(await screen.findByLabelText('Email'), 'maya@example.com')
        await user.type(screen.getByLabelText('Password'), 'nodigits')
        await user.click(screen.getByRole('button', { name: 'Log in' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('at least one number')
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    test('a job seeker with valid details is logged in and taken to the jobs page', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(
                JSON.stringify({
                    access_token: 'test-token',
                    user: { id: '00000000-0000-4000-8000-000000000001', role: 'job_seeker' },
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
        )
        const { user } = renderApp('/login', { loggedIn: false })

        await user.type(await screen.findByLabelText('Email'), 'maya@example.com')
        await user.type(screen.getByLabelText('Password'), 'secret12')
        await user.click(screen.getByRole('button', { name: 'Log in' }))

        expect(await screen.findByRole('heading', { name: 'Find jobs' })).toBeInTheDocument()
        const [url, options] = fetchSpy.mock.calls[0]
        expect(url).toMatch(/\/api\/auth\/login$/)
        expect(JSON.parse(options.body)).toEqual({ email: 'maya@example.com', password: 'secret12' })
    })
})
