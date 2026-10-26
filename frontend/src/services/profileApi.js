import { request, USE_MOCK_API } from './apiClient.js'
import { getUserId } from './session.js'
import { delay, fileToDataUrl, newId, readDb, writeDb } from './mockStore.js'

// Profile = personal info + photo (+ experiences, education, skills, background in sample-data mode).
// Backend routes:
//   GET/PUT /api/profiles/<id>                 -> { profile }  (personal info)
//   GET     /api/profiles/<id>/picture         -> { url }      (404 = no photo)
//   POST    /api/profiles/<id>/picture         multipart "picture" (JPG/PNG, max 2 MB)
// Not in the backend yet: experiences, education, skills, background image.

// Turn these on when the backend adds the matching routes.
export const SECTIONS_SUPPORTED = USE_MOCK_API // experience, education, skills
export const COVER_SUPPORTED = USE_MOCK_API // background image

const base = () => `/api/profiles/${getUserId()}`

async function getPictureUrl() {
    try {
        const data = await request(`${base()}/picture`)
        return data.url ?? ''
    } catch {
        return '' // 404 = no photo uploaded yet
    }
}

export async function getFullProfile() {
    if (USE_MOCK_API) {
        const { profile, experiences, education, skills } = readDb()
        return delay({ profile, experiences, education, skills })
    }
    const [data, avatar_url] = await Promise.all([request(base()), getPictureUrl()])
    return {
        profile: { ...data.profile, avatar_url, cover_url: '' },
        experiences: data.experiences ?? [],
        education: data.education ?? [],
        skills: data.skills ?? [],
    }
}

export async function updatePersonalInfo(fields) {
    if (USE_MOCK_API) {
        const db = readDb()
        db.profile = { ...db.profile, ...fields }
        writeDb(db)
        return delay(db.profile)
    }
    const data = await request(base(), { method: 'PUT', body: fields })
    return data.profile
}

function replaceList(key, items, prefix) {
    if (USE_MOCK_API) {
        const db = readDb()
        db[key] = items.map((item) =>
            typeof item === 'string' ? item : { ...item, id: item.id || newId(prefix) },
        )
        writeDb(db)
        return delay(db[key])
    }
    return Promise.reject(new Error('Saving this section is not available yet.'))
}

export const updateExperiences = (items) => replaceList('experiences', items, 'exp')
export const updateEducation = (items) => replaceList('education', items, 'edu')
export const updateSkills = (items) => replaceList('skills', items, 'skill')

export async function uploadAvatar(file) {
    if (USE_MOCK_API) {
        const db = readDb()
        db.profile.avatar_url = await fileToDataUrl(file)
        writeDb(db)
        return delay(db.profile.avatar_url)
    }
    const formData = new FormData()
    formData.append('picture', file)
    await request(`${base()}/picture`, { method: 'POST', formData })
    return getPictureUrl() // the upload returns a storage path; ask for a viewable link
}

export async function uploadCover(file) {
    if (!USE_MOCK_API) throw new Error('Background images are not available yet.')
    const db = readDb()
    db.profile.cover_url = await fileToDataUrl(file)
    writeDb(db)
    return delay(db.profile.cover_url)
}

export async function removeCover() {
    if (!USE_MOCK_API) return ''
    const db = readDb()
    db.profile.cover_url = ''
    writeDb(db)
    return delay('')
}
