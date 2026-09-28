import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { login } from '../services/authApi.js'
import './LoginForm.css'

function LoginForm() {
    const [error, setError] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const location = useLocation()
    const navigate = useNavigate()

    async function handleSubmit(event) {
        event.preventDefault()
        setError('')
        setIsSubmitting(true)

        const formData = new FormData(event.currentTarget)
        try {
            const response = await login({
                email: formData.get('email').trim(),
                password: formData.get('password'),
            })
            const token =
                response.token ??
                response.access_token ??
                response.session?.access_token
            if (typeof token !== 'string' || !token) {
                throw new Error(
                    'Login succeeded, but the server did not return an authentication token.',
                )
            }

            window.localStorage.setItem('token', token)
            if (typeof response.user?.id === 'string') {
                window.localStorage.setItem('userId', response.user.id)
            }
            navigate('/', { replace: true })
        } catch (requestError) {
            setError(requestError.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <main className="auth-page">
            <section className="auth-card" aria-labelledby="login-heading">
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
                            required
                        />
                    </label>
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
                    New to CareerConnect? <Link to="/register">Create an account</Link>
                </p>
            </section>
        </main>
    )
}

export default LoginForm