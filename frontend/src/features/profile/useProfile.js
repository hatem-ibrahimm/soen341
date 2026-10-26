import { useCallback, useEffect, useState } from 'react'
import { useCurrentUser } from '../../context/CurrentUserContext.jsx'
import * as profileApi from '../../services/profileApi.js'

const PERSONAL_FIELDS = ['first_name', 'last_name', 'title', 'email', 'phone_number', 'location', 'bio']

// Loads the full profile and exposes one save function per section.
// Each save updates local state so the page re-renders without a reload.
export default function useProfile() {
    const { setUser } = useCurrentUser()
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        let active = true
        profileApi
            .getFullProfile()
            .then((d) => active && setData(d))
            .catch((e) => active && setError(e.message))
            .finally(() => active && setLoading(false))
        return () => {
            active = false
        }
    }, [])

    // The backend PUT requires first_name, last_name and email every time,
    // so always send the full set of personal fields, not just the changed ones.
    const savePersonal = async (fields) => {
        const merged = { ...data.profile, ...fields }
        const body = Object.fromEntries(PERSONAL_FIELDS.map((k) => [k, merged[k] ?? '']))
        const profile = await profileApi.updatePersonalInfo(body)
        const next = { ...merged, ...profile }
        setData((d) => ({ ...d, profile: next }))
        setUser(next)
    }

    // Saves one image field (avatar_url or cover_url) and updates the page + top bar.
    const saveImage = useCallback(
        async (key, apiCall) => {
            const url = await apiCall()
            setData((d) => {
                const profile = { ...d.profile, [key]: url }
                setUser(profile)
                return { ...d, profile }
            })
        },
        [setUser],
    )
    const saveAvatar = (file) => saveImage('avatar_url', () => profileApi.uploadAvatar(file))
    const saveCover = (file) => saveImage('cover_url', () => profileApi.uploadCover(file))
    const removeCover = () => saveImage('cover_url', () => profileApi.removeCover())

    const saveList = (key, fn) => async (items) => {
        const saved = await fn(items)
        setData((d) => ({ ...d, [key]: saved }))
    }

    return {
        ...(data ?? {}),
        loading,
        error,
        savePersonal,
        saveAvatar,
        saveCover,
        removeCover,
        saveExperiences: saveList('experiences', profileApi.updateExperiences),
        saveEducation: saveList('education', profileApi.updateEducation),
        saveSkills: saveList('skills', profileApi.updateSkills),
    }
}
