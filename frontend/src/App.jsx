import { Navigate, Route, Routes } from 'react-router-dom'

import HomePage from './components/HomePage.jsx'
import AppLayout from './components/layout/AppLayout.jsx'
import RequireAuth from './components/layout/RequireAuth.jsx'
import LoginForm from './components/LoginForm.jsx'
import RegistrationForm from './components/RegistrationForm.jsx'
import RecruiterDashboard from './components/RecruiterDashboard.jsx'
import RecruiterApplicantProfile from './components/RecruiterApplicantProfile.jsx'
import AnalyticsDashboardPage from './features/analytics/AnalyticsDashboardPage.jsx'
import ApplicationSubmittedPage from './features/applications/ApplicationSubmittedPage.jsx'
import ApplyPage from './features/applications/ApplyPage.jsx'
import MyApplicationsPage from './features/applications/MyApplicationsPage.jsx'
import InterviewCoordinationPage from './features/applications/InterviewCoordinationPage.jsx'
import NotificationsPage from './features/notifications/NotificationsPage.jsx'
import JobDetailsPlaceholderPage from './features/jobs/JobDetailsPlaceholderPage.jsx'
import JobsPlaceholderPage from './features/jobs/JobsPlaceholderPage.jsx'
import ProfilePage from './features/profile/ProfilePage.jsx'
import ResumeFeedbackPage from './features/resumeFeedback/ResumeFeedbackPage.jsx'
import { getUserRole, isLoggedIn } from './services/session.js'

function App() {
    return (
        <Routes>
            {/* Public pages */}
            <Route
                path="/"
                element={
                    isLoggedIn()
                        ? <Navigate to={getUserRole() === 'recruiter' ? '/recruiter' : '/jobs'} replace />
                        : <HomePage />
                }
            />
            <Route path="/login" element={<LoginForm />} />
            <Route path="/register" element={<RegistrationForm />} />

            {/* Logged-in pages share the top bar with the profile circle */}
            <Route element={<RequireAuth />}>
                <Route element={<AppLayout />}>
                    <Route path="/jobs" element={<JobsPlaceholderPage/>} />
                    <Route path="/jobs/:jobId" element={<JobDetailsPlaceholderPage/>} />
                    <Route path="/jobs/:jobId/apply" element={<ApplyPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/applications" element={<MyApplicationsPage />} />
                    <Route path="/applications/:applicationId/interview" element={<InterviewCoordinationPage />} />
                    <Route path="/notifications" element={<NotificationsPage />} />
                    <Route
                        path="/recruiter"
                        element={
                            getUserRole() === 'recruiter'
                                ? <RecruiterDashboard />
                                : <Navigate to="/jobs" replace />
                        }
                    />
                    <Route
                        path="/recruiter/applications/:applicationId/profile"
                        element={
                            getUserRole() === 'recruiter'
                                ? <RecruiterApplicantProfile />
                                : <Navigate to="/jobs" replace />
                        }
                    />
                    <Route path="/applications/:applicationId/submitted" element={<ApplicationSubmittedPage />} />
                    {/* Sprint 3 */}
                    <Route path="/dashboard" element={<AnalyticsDashboardPage />} />
                    <Route path="/resume-feedback" element={<ResumeFeedbackPage />} />
                </Route>
            </Route>
            <Route path="/profilemanagement" element={<Navigate to="/profile" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}

export default App