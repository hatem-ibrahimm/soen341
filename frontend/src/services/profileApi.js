import { request, USE_MOCK_API } from './apiClient.js'
import { getUserId } from './session.js'
import { delay, fileToDataUrl, newId, readDb, writeDb } from './mockStore.js'

// Profile = personal info + experiences + education + skills.
// Backend routes (US-02 already has GET/PUT /api/profiles/<id>):
//   GET  /api/profiles/<id>              -> { profile, experiences, education, skills }
//   PUT  /api/profiles/<id>              body: personal fields
//   PUT  /api/profiles/<id>/experiences  body: { experiences: [...] }  (replace list)
//   PUT  /api/profiles/<id>/education    body: { education: [...] }
//   PUT  /api/profiles/<id>/skills       body: { skills: ["React", ...] }
//   POST /api/profiles/<id>/avatar       multipart "file" -> { avatar_url }
//   POST /api/profiles/<id>/cover        multipart "file" -> { cover_url }   (background image)
//   DELETE /api/profiles/<id>/cover      -> back to the default grey background

const base = () => `/api/profiles/${getUserId()}`

export async function getFullProfile() {
    if (USE_MOCK_API) {
        const { profile, experiences, education, skills } = readDb()
        return delay({ profile, experiences, education, skills })
    }
    const data = await request(base())
    return {
        profile: data.profile,
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
    return request(`${base()}/${key}`, { method: 'PUT', body: { [key]: items } }).then(
        (data) => data[key],
    )
}

export const updateExperiences = (items) => replaceList('experiences', items, 'exp')
export const updateEducation = (items) => replaceList('education', items, 'edu')
export const updateSkills = (items) => replaceList('skills', items, 'skill')

// Shared by the profile picture and the background (cover) image.
async function uploadImage(kind, file) {
    const key = `${kind}_url` // avatar_url or cover_url
    if (USE_MOCK_API) {
        const db = readDb()
        db.profile[key] = await fileToDataUrl(file)
        writeDb(db)
        return delay(db.profile[key])
    }
    const formData = new FormData()
    formData.append('file', file)
    const data = await request(`${base()}/${kind}`, { method: 'POST', formData })
    return data[key]
}

export const uploadAvatar = (file) => uploadImage('avatar', file)
export const uploadCover = (file) => uploadImage('cover', file)

export async function removeCover() {
    if (USE_MOCK_API) {
        const db = readDb()
        db.profile.cover_url = ''
        writeDb(db)
        return delay('')
    }
    await request(`${base()}/cover`, { method: 'DELETE' })
    return ''
}
