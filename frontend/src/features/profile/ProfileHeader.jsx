import { useRef, useState } from 'react'
import { Avatar, Button } from '../../components/common'
import styles from './ProfilePage.module.css'

const MAX_PHOTO = 2 * 1024 * 1024 // 2 MB
const MAX_COVER = 4 * 1024 * 1024 // 4 MB

function checkImage(file, max) {
    if (!file.type.startsWith('image/')) return 'Please choose an image file (JPG, PNG, ...).'
    if (file.size > max) return `Images must be ${max / 1024 / 1024} MB or smaller.`
    return ''
}

// Intro card: background (cover) image, centered photo, name, title and contact details.
export default function ProfileHeader({ profile, onEdit, onAvatarChange, onCoverChange, onCoverRemove }) {
    const photoInput = useRef(null)
    const coverInput = useRef(null)
    const [busy, setBusy] = useState('') // "photo" | "cover" | ""
    const [error, setError] = useState('')

    async function upload(kind, file) {
        const problem = checkImage(file, kind === 'photo' ? MAX_PHOTO : MAX_COVER)
        if (problem) return setError(problem)
        setError('')
        setBusy(kind)
        try {
            await (kind === 'photo' ? onAvatarChange(file) : onCoverChange(file))
        } catch (err) {
            setError(err.message)
        } finally {
            setBusy('')
        }
    }

    function pick(kind) {
        return (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) upload(kind, file)
        }
    }

    async function removeCover() {
        setBusy('cover')
        try {
            await onCoverRemove()
        } catch (err) {
            setError(err.message)
        } finally {
            setBusy('')
        }
    }

    const contact = [profile.location, profile.email, profile.phone_number].filter(Boolean)

    return (
        <section className={styles.headerCard}>
            {/* Grey by default; shows the user's background image when they add one */}
            <div
                className={styles.cover}
                style={profile.cover_url ? { backgroundImage: `url("${profile.cover_url}")` } : undefined}
            >
                <div className={styles.coverActions}>
                    <button className={styles.coverBtn} onClick={() => coverInput.current?.click()} disabled={busy === 'cover'}>
                        {busy === 'cover' ? 'Saving…' : profile.cover_url ? 'Change background' : 'Add background'}
                    </button>
                    {profile.cover_url && (
                        <button className={styles.coverBtn} onClick={removeCover} disabled={busy === 'cover'}>
                            Remove
                        </button>
                    )}
                </div>
                <input ref={coverInput} type="file" accept="image/*" hidden onChange={pick('cover')} />
            </div>

            <div className={styles.headerBody}>
                <Avatar
                    firstName={profile.first_name}
                    lastName={profile.last_name}
                    src={profile.avatar_url}
                    size={120}
                    className={styles.bigAvatar}
                />
                <button className={styles.photoLink} onClick={() => photoInput.current?.click()} disabled={busy === 'photo'}>
                    {busy === 'photo' ? 'Uploading…' : profile.avatar_url ? 'Change photo' : 'Add photo'}
                </button>
                <input ref={photoInput} type="file" accept="image/*" hidden onChange={pick('photo')} />
                {error && <p className={styles.inlineError} role="alert">{error}</p>}

                <h1 className={styles.name}>
                    {profile.first_name || 'Your'} {profile.last_name || 'name'}
                </h1>
                <p className={styles.headline}>
                    {profile.title || <span className={styles.placeholder}>Add a professional title</span>}
                </p>
                {contact.length > 0 && (
                    <ul className={styles.contactRow}>
                        {contact.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                )}
                <Button variant="secondary" size="sm" onClick={onEdit} className={styles.headerEdit}>
                    Edit personal info
                </Button>
            </div>
        </section>
    )
}
