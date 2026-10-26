import { Navigate, Route, Routes } from 'react-router-dom'

import HomePage from './components/HomePage.jsx'
import LoginForm from './components/LoginForm.jsx'
import RegistrationForm from './components/RegistrationForm.jsx'
import ProfileManagement from './components/ProfileManagement.jsx'
import JobListings from './components/JobListings.jsx'
import JobDetails from './components/JobDetails.jsx'

function App() {
    return (
        <Routes>
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