import { Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './components/HomePage.jsx'
import LoginForm from './components/LoginForm.jsx'
import ProfileManagement from './components/ProfileManagement.jsx'
import RegistrationForm from './components/RegistrationForm.jsx'

function App() {
    return (
        <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginForm />} />
            <Route path="/register" element={<RegistrationForm />} />
            <Route path="/profilemanagement" element={<ProfileManagement />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}

export default App