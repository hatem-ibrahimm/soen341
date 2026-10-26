import { useState } from 'react'
import { Alert, Button, Card, EmptyState, Modal } from '../../components/common'
import styles from './ProfilePage.module.css'

export default function SkillsSection({ skills, onSave }) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState([])
    const [input, setInput] = useState('')
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    function open() {
        setDraft(skills)
        setInput('')
        setError('')
        setEditing(true)
    }

    function add(e) {
        e.preventDefault()
        const value = input.trim()
        if (!value) return
        if (draft.some((s) => s.toLowerCase() === value.toLowerCase())) {
            setError(`"${value}" is already in your skills.`)
            return
        }
        setDraft([...draft, value])
        setInput('')
        setError('')
    }

    async function save() {
        setSaving(true)
        try {
            await onSave(draft)
            setEditing(false)
        } catch (e) {
            setError(e.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <Card id="skills" title="Skills" actions={skills.length > 0 && <Button size="sm" variant="secondary" onClick={open}>Edit</Button>}>
            {skills.length ? (
                <div className={styles.chips}>
                    {skills.map((s) => (
                        <span key={s} className={styles.chip}>{s}</span>
                    ))}
                </div>
            ) : (
                <EmptyState icon="★" title="Add skills recruiters search for" action={<Button size="sm" variant="secondary" onClick={open}>Add skills</Button>} />
            )}

            {editing && (
                <Modal
                    title="Edit skills"
                    onClose={() => setEditing(false)}
                    footer={
                        <>
                            <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                        </>
                    }
                >
                    <form className={styles.skillForm} onSubmit={add}>
                        <input
                            placeholder="Type a skill and press Enter (e.g. React)"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            aria-label="New skill"
                            autoFocus
                        />
                        <Button type="submit" variant="secondary">Add</Button>
                    </form>
                    {error && <Alert tone="error">{error}</Alert>}
                    <div className={styles.chips} style={{ marginTop: 14 }}>
                        {draft.map((s) => (
                            <span key={s} className={`${styles.chip} ${styles.chipEditable}`}>
                                {s}
                                <button onClick={() => setDraft(draft.filter((x) => x !== s))} aria-label={`Remove ${s}`}>×</button>
                            </span>
                        ))}
                        {draft.length === 0 && <span className={styles.placeholder}>No skills yet.</span>}
                    </div>
                </Modal>
            )}
        </Card>
    )
}
