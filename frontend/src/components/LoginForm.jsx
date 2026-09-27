import { Link } from 'react-router-dom'
import './LoginForm.css'

function LoginForm() {
    return (
        <main>
            <h1>Log in</h1>
            <form>
                <label>
                    Email
                    <input type="email" name="email" autoComplete="email" />
                </label>
                <label>
                    Password
                    <input
                        type="password"
                        name="password"
                        autoComplete="current-password"
                    />
                </label>
                <button type="submit">Log in</button>
            </form>
            <p>
                New to CareerConnect? <Link to="/register">Create an account</Link>
            </p>
        </main>
    )
}

export default LoginForm