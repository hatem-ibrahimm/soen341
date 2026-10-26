import { useState } from 'react'
import { Button, Card, EmptyState, Modal, TextField } from '../../components/common'
import styles from './ProfilePage.module.css'

const MAX = 1000

export default function AboutSection({ bio, onSave }) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    function open() {
        setDraft(bio ?? '')
        setError('')
        setEditing(true)
    }

    async function save() {
        setSaving(true)
        try {
            await onSave({ bio: draft })
            setEditing(false)
        } catch (e) {
            setError(e.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <Card
            id="about"
            title="About"
            actions={bio && <Button size="sm" variant="secondary" onClick={open}>Edit</Button>}
        >
            {bio ? (
                <p className={styles.bio}>{bio}</p>
            ) : (
                <EmptyState title="Tell recruiters about yourself" action={<Button size="sm" variant="secondary" onClick={open}>Add summary</Button>}>
                    A short summary of who you are and what you are looking for.
                </EmptyState>
            )}

            {editing && (
                <Modal
                    title="Edit about"
                    onClose={() => setEditing(false)}
                    footer={
                        <>
                            <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                            <Button onClick={save} disabled={saving || draft.length > MAX}>{saving ? 'Saving…' : 'Save'}</Button>
                        </>
                    }
                >
                    <TextField
                        label="Summary"
                        multiline
                        rows={7}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        hint={`${draft.length}/${MAX} characters`}
                        error={draft.length > MAX ? `Keep it under ${MAX} characters.` : error}
                    />
                </Modal>
            )}
        </Card>
    )
}
