import { Link } from 'react-router-dom'
import './HomePage.css'

function HomePage() {
    const isLoggedIn = Boolean(window.localStorage.getItem('token'))

    return (
        <main className="home-page">
            <header className="home-header">
                <Link className="home-brand" to="/">
                    <span className="home-brand-mark" aria-hidden="true" />
                    CareerConnect
                </Link>
                <nav className="home-nav" aria-label="Main navigation">
                    {isLoggedIn ? (
                        <Link className="home-nav-primary" to="/profilemanagement">
                            My profile
                        </Link>
                    ) : (
                        <>
                            <Link to="/login">Log in</Link>
                            <Link className="home-nav-primary" to="/register">
                                Get started
                            </Link>
                        </>
                    )}
                </nav>
            </header>

            <section className="home-hero">
                <p className="home-eyebrow">Your next chapter starts here</p>
                <h1>Make your job search work for you.</h1>
                <p className="home-description">
                    Keep your professional profile organized and ready for your next
                    opportunity with CareerConnect.
                </p>
                <div className="home-actions">
                    <Link className="home-button home-button-primary" to="/profilemanagement">
                        Manage your profile
                    </Link>
                    <Link className="home-button home-button-secondary" to="/register">
                        Create an account
                    </Link>
                </div>
            </section>

            <section className="home-feature" aria-labelledby="profile-feature-heading">
                <div className="home-feature-icon" aria-hidden="true">✦</div>
                <div>
                    <h2 id="profile-feature-heading">A profile that’s ready to share</h2>
                    <p>
                        Add your experience, education, and skills in one place, then
                        come back any time to keep them up to date.
                    </p>
                </div>
                <Link to="/profilemanagement">Open profile management <span aria-hidden="true">→</span></Link>
            </section>
        </main>
    )
}

export default HomePage
