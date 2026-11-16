import { useState } from 'react'
import {
    Link,
    useLocation,
    useNavigate,
} from 'react-router-dom'
import { login } from '../services/authApi.js'
import {
    PASSWORD_REQUIREMENTS,
    validatePassword,
} from '../utils/passwordValidation.js'
import { saveSession } from '../services/session.js'
import './LoginForm.css'

function getReturnDestination(value) {
    if (
        typeof value === 'string' &&
        /^\/jobs(?:\/[^?#\\]*)*(?:\?[^#\\]*)?$/.test(value)
    ) {
        return value
    }

    // Go straight to the jobs page. Sending a logged-in user to '/' showed the
    // public home page, because App.jsx decides what '/' shows only on first load.
    return '/jobs'
}

function LoginForm() {
    const [error, setError] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const location = useLocation()
    const navigate = useNavigate()

    async function handleSubmit(event) {
        event.preventDefault()

        if (isSubmitting) return

        setError('')

        const formData = new FormData(event.currentTarget)
        const email = String(formData.get('email') ?? '').trim()
        const password = String(formData.get('password') ?? '')

        // Sprint 2: retain frontend password-policy validation.
        // Do not trim or otherwise modify the password.
        const passwordError = validatePassword(password)

        if (passwordError) {
            setError(passwordError)
            return
        }

        setIsSubmitting(true)

        try {
            const response = await login({ email, password })

            const token =
                response.token ??
                response.access_token ??
                response.session?.access_token

            if (typeof token !== 'string' || !token) {
                throw new Error(
                    'Login succeeded, but the server did not return an authentication token.',
                )
            }

            const userId = response.user?.id
            const validUserId = (
                (typeof userId === 'string' && userId.trim() !== '') ||
                (typeof userId === 'number' && Number.isFinite(userId))
            ) ? String(userId) : null
            const role = response.user?.role === 'recruiter' ? 'recruiter' : 'job_seeker'
            saveSession(token, validUserId, role, response.user?.company_name ?? '')

            const destination = role === 'recruiter'
                ? '/recruiter'
                : getReturnDestination(location.state?.returnTo ?? location.state?.from)
            navigate(destination, { replace: true })
        } catch (requestError) {
            setError(
                requestError.message ||
                'Unable to log in. Please try again.',
            )
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <main className="auth-page">
            <section
                className="auth-card"
                aria-labelledby="login-heading"
            >
                <h1 id="login-heading">Log in</h1>

                {location.state?.message && (
                    <p className="auth-success" role="status">
                        {location.state.message}
                    </p>
                )}

                <form onSubmit={handleSubmit}>
                    <label>
                        Email
                        <input
                            type="email"
                            name="email"
                            autoComplete="email"
                            required
                        />
                    </label>

                    <label>
                        Password
                        <input
                            type="password"
                            name="password"
                            autoComplete="current-password"
                            aria-describedby="login-password-help"
                            required
                        />
                    </label>

                    <p id="login-password-help">
                        {PASSWORD_REQUIREMENTS}
                    </p>

                    {error && (
                        <p className="auth-error" role="alert">
                            {error}
                        </p>
                    )}

                    <button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Logging in…' : 'Log in'}
                    </button>
                </form>

                <p>
                    New to CareerConnect?{' '}
                    <Link to="/register">Create an account</Link>
                </p>
            </section>
        </main>
    )
}

export default LoginForm