import { Link } from 'react-router-dom'
import './RegistrationForm.css'

function RegistrationForm() {
    return (
        <main>
            <h1>Create an account</h1>
            <form>
                <label>
                    Name
                    <input type="text" name="name" autoComplete="name" />
                </label>
                <label>
                    Email
                    <input type="email" name="email" autoComplete="email" />
                </label>
                <label>
                    Password
                    <input
                        type="password"
                        name="password"
                        autoComplete="new-password"
                    />
                </label>
                <button type="submit">Create account</button>
            </form>
            <p>
                Already have an account? <Link to="/login">Log in</Link>
            </p>
        </main>
    )
}

export default RegistrationForm