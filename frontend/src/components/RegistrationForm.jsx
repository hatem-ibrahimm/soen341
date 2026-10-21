import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../services/authApi.js'
import './RegistrationForm.css'

function RegistrationForm() {
    const [error, setError] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const navigate = useNavigate()

    async function handleSubmit(event) {
        event.preventDefault()
        setError('')

        const formData = new FormData(event.currentTarget)
        const password = formData.get('password')
        const confirmPassword = formData.get('confirmPassword')

        if (password !== confirmPassword) {
            setError('Passwords do not match.')
            return
        }

        setIsSubmitting(true)
        try {
            await register({
                email: formData.get('email').trim(),
                password,
                firstName: formData.get('firstName').trim(),
                lastName: formData.get('lastName').trim(),
            })
            navigate('/login', {
                replace: true,
                state: { message: 'Your account has been created. Please log in.' },
            })
        } catch (requestError) {
            setError(requestError.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <main className="auth-page">
            <section className="auth-card" aria-labelledby="registration-heading">
                <h1 id="registration-heading">Create an account</h1>
                <form onSubmit={handleSubmit}>
                    <label>
                        First name
                        <input
                            type="text"
                            name="firstName"
                            autoComplete="given-name"
                            required
                        />
                    </label>
                    <label>
                        Last name
                        <input
                            type="text"
                            name="lastName"
                            autoComplete="family-name"
                            required
                        />
                    </label>
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
                            autoComplete="new-password"
                            required
                        />
                    </label>
                    <label>
                        Confirm password
                        <input
                            type="password"
                            name="confirmPassword"
                            autoComplete="new-password"
                            required
                        />
                    </label>
                    {error && (
                        <p className="auth-error" role="alert">
                            {error}
                        </p>
                    )}
                    <button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Creating account…' : 'Create account'}
                    </button>
                </form>
                <p>
                    Already have an account? <Link to="/login">Log in</Link>
                </p>
            </section>
        </main>
    )
}

export default RegistrationForm