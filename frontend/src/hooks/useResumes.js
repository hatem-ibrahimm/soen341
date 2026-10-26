import { useCallback, useEffect, useState } from 'react'
import * as resumeApi from '../services/resumeApi.js'

// Shared by the Profile page (manage resumes) and the Apply page (pick a resume).
export default function useResumes() {
    const [resumes, setResumes] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [busyId, setBusyId] = useState(null) // id of the resume being changed, or "new"

    useEffect(() => {
        resumeApi
            .listResumes()
            .then(setResumes)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false))
    }, [])

    const run = useCallback(async (id, action) => {
        setBusyId(id)
        setError('')
        try {
            return await action()
        } catch (e) {
            setError(e.message)
            return null
        } finally {
            setBusyId(null)
        }
    }, [])

    const upload = (file) => {
        const problem = resumeApi.validateResumeFile(file)
        if (problem) {
            setError(problem)
            return Promise.resolve(null)
        }
        return run('new', async () => {
            const resume = await resumeApi.uploadResume(file)
            setResumes((list) => [resume, ...list.filter((r) => r.id !== resume.id)])
            return resume
        })
    }

    const replace = (id, file) => {
        const problem = resumeApi.validateResumeFile(file)
        if (problem) {
            setError(problem)
            return Promise.resolve(null)
        }
        return run(id, async () => {
            const resume = await resumeApi.replaceResume(id, file)
            setResumes((list) => list.map((r) => (r.id === id ? resume : r)))
            return resume
        })
    }

    const makeDefault = (id) => run(id, async () => setResumes(await resumeApi.setDefaultResume(id)))
    const remove = (id) => run(id, async () => setResumes(await resumeApi.deleteResume(id)))

    return { resumes, loading, error, setError, busyId, upload, replace, makeDefault, remove }
}
