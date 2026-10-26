import { useState } from 'react'
import { Alert, Button, Card, EmptyState, FormGrid, Modal, TextField } from '../../components/common'
import styles from './ProfilePage.module.css'

// Each entry is shown on a small timeline (dot + line) with its own Edit button.
// Reusable section for lists of entries (Work experience, Education, ...).
// Pass a `fields` config and the section handles add / edit / delete.
//
//   fields: [{ name, label, required?, full?, multiline?, placeholder? }]
//   renderItem(item) -> JSX for the read-only view of one entry
export default function EntryListSection({ id, title, icon, items, fields, renderItem, onSave, emptyText, addLabel }) {
    const [editing, setEditing] = useState(null) // { index, values } ; index -1 = new
    const [errors, setErrors] = useState({})
    const [saving, setSaving] = useState(false)
    const [serverError, setServerError] = useState('')

    const renderLabel = (item) => item[fields[0].name] || title
    const blank = Object.fromEntries(fields.map((f) => [f.name, '']))

    function openNew() {
        setEditing({ index: -1, values: blank })
        setErrors({})
        setServerError('')
    }
    function openEdit(index) {
        setEditing({ index, values: { ...blank, ...items[index] } })
        setErrors({})
        setServerError('')
    }

    async function persist(nextItems) {
        setSaving(true)
        setServerError('')
        try {
            await onSave(nextItems)
            setEditing(null)
        } catch (e) {
            setServerError(e.message)
        } finally {
            setSaving(false)
        }
    }

    function submit(e) {
        e.preventDefault()
        const found = {}
        for (const f of fields) {
            if (f.required && !String(editing.values[f.name] ?? '').trim()) found[f.name] = `${f.label} is required.`
        }
        setErrors(found)
        if (Object.keys(found).length) return
        const next = [...items]
        if (editing.index === -1) next.unshift(editing.values)
        else next[editing.index] = editing.values
        persist(next)
    }

    function remove() {
        persist(items.filter((_, i) => i !== editing.index))
    }

    const change = (e) => setEditing({ ...editing, values: { ...editing.values, [e.target.name]: e.target.value } })

    return (
        <Card
            id={id}
            title={title}
            actions={items.length > 0 && <Button size="sm" variant="secondary" onClick={openNew}>+ Add</Button>}
        >
            {items.length === 0 ? (
                <EmptyState icon={icon} title={emptyText} action={<Button size="sm" variant="secondary" onClick={openNew}>{addLabel}</Button>} />
            ) : (
                <ul className={styles.entryList}>
                    {items.map((item, i) => (
                        <li key={item.id ?? i} className={styles.entry}>
                            <div className={styles.entryBody}>{renderItem(item)}</div>
                            <Button size="sm" variant="ghost" onClick={() => openEdit(i)} aria-label={`Edit ${renderLabel(item)}`}>
                                Edit
                            </Button>
                        </li>
                    ))}
                </ul>
            )}

            {editing && (
                <Modal
                    title={editing.index === -1 ? addLabel : `Edit ${title.toLowerCase()}`}
                    onClose={() => setEditing(null)}
                    footer={
                        <>
                            {editing.index !== -1 && (
                                <Button variant="danger" onClick={remove} disabled={saving} style={{ marginRight: 'auto' }}>
                                    Delete
                                </Button>
                            )}
                            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                            <Button type="submit" form={`form-${title}`} disabled={saving}>
                                {saving ? 'Saving…' : 'Save'}
                            </Button>
                        </>
                    }
                >
                    <form id={`form-${title}`} onSubmit={submit} noValidate>
                        {serverError && <Alert tone="error">{serverError}</Alert>}
                        <FormGrid>
                            {fields.map((f) => (
                                <TextField
                                    key={f.name}
                                    name={f.name}
                                    label={f.label}
                                    required={f.required}
                                    full={f.full}
                                    multiline={f.multiline}
                                    placeholder={f.placeholder}
                                    value={editing.values[f.name] ?? ''}
                                    onChange={change}
                                    error={errors[f.name]}
                                />
                            ))}
                        </FormGrid>
                    </form>
                </Modal>
            )}
        </Card>
    )
}
