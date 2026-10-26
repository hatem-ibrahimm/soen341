import { Navigate, Route, Routes } from 'react-router-dom'

import HomePage from './components/HomePage.jsx'
import AppLayout from './components/layout/AppLayout.jsx'
import RequireAuth from './components/layout/RequireAuth.jsx'
import LoginForm from './components/LoginForm.jsx'
import RegistrationForm from './components/RegistrationForm.jsx'
import ApplicationSubmittedPage from './features/applications/ApplicationSubmittedPage.jsx'
import ApplyPage from './features/applications/ApplyPage.jsx'
import MyApplicationsPage from './features/applications/MyApplicationsPage.jsx'
import JobDetailsPlaceholderPage from './features/jobs/JobDetailsPlaceholderPage.jsx'
import JobsPlaceholderPage from './features/jobs/JobsPlaceholderPage.jsx'
import ProfilePage from './features/profile/ProfilePage.jsx'
import { isLoggedIn } from './services/session.js'
import ProfileManagement from './components/ProfileManagement.jsx'
import JobListings from './components/JobListings.jsx'
import JobDetails from './components/JobDetails.jsx'

function App() {
    return (
        <Routes>
            {/* Public pages */}
            <Route path="/" element={isLoggedIn() ? <Navigate to="/jobs" replace /> : <HomePage />} />
            <Route path="/login" element={<LoginForm />} />
            <Route path="/register" element={<RegistrationForm />} />

            {/* Logged-in pages share the top bar with the profile circle */}
            <Route element={<RequireAuth />}>
                <Route element={<AppLayout />}>
                    {/* TODO: swap the two placeholder job pages for the Job Listing feature */}
                    <Route path="/jobs" element={<JobsPlaceholderPage />} />
                    <Route path="/jobs/:jobId" element={<JobDetailsPlaceholderPage />} />
                    <Route path="/jobs/:jobId/apply" element={<ApplyPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/applications" element={<MyApplicationsPage />} />
                    <Route path="/applications/:applicationId/submitted" element={<ApplicationSubmittedPage />} />
                </Route>
            </Route>
            <Route path="/profilemanagement" element={<Navigate to="/profile" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
            <Route
                path="/"
                element={<HomePage />}
            />

            <Route
                path="/login"
                element={<LoginForm />}
            />

            <Route
                path="/register"
                element={<RegistrationForm />}
            />

            <Route
                path="/profilemanagement"
                element={<ProfileManagement />}
            />

            <Route
                path="/jobs"
                element={<JobListings />}
            />

            <Route
                path="/jobs/:jobId"
                element={<JobDetails />}
            />

            <Route
                path="*"
                element={<Navigate to="/" replace />}
            />
        </Routes>
    )
}

export default App