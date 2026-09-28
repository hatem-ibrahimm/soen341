import { Navigate, Route, Routes } from 'react-router-dom'
import LoginForm from './components/LoginForm.jsx'
import RegistrationForm from './components/RegistrationForm.jsx'

function App() {
    return (
        <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginForm />} />
            <Route path="/register" element={<RegistrationForm />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    )
}

export default App