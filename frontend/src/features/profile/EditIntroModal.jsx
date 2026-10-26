import { useState } from 'react'
import { Alert, Button, FormGrid, Modal, TextField } from '../../components/common'

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const PHONE = /^[+()\d\s.-]{7,20}$/

function validatePersonal(f) {
    const errors = {}
    if (!f.first_name.trim()) errors.first_name = 'First name is required.'
    if (!f.last_name.trim()) errors.last_name = 'Last name is required.'
    if (!EMAIL.test(f.email.trim())) errors.email = 'Enter a valid email address.'
    if (f.phone_number.trim() && !PHONE.test(f.phone_number.trim()))
        errors.phone_number = 'Enter a valid phone number.'
    return errors
}

// Personal information: name, title, email, phone, location.
export default function EditIntroModal({ profile, onSave, onClose }) {
    const [form, setForm] = useState({
        first_name: profile.first_name ?? '',
        last_name: profile.last_name ?? '',
        title: profile.title ?? '',
        email: profile.email ?? '',
        phone_number: profile.phone_number ?? '',
        location: profile.location ?? '',
    })
    const [errors, setErrors] = useState({})
    const [saving, setSaving] = useState(false)
    const [serverError, setServerError] = useState('')

    const change = (e) => setForm({ ...form, [e.target.name]: e.target.value })

    async function submit(e) {
        e.preventDefault()
        const found = validatePersonal(form)
        setErrors(found)
        if (Object.keys(found).length) return
        setSaving(true)
        setServerError('')
        try {
            await onSave(form)
            onClose()
        } catch (err) {
            setServerError(err.message)
            setSaving(false)
        }
    }

    return (
        <Modal
            title="Edit intro"
            onClose={onClose}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button type="submit" form="intro-form" disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                    </Button>
                </>
            }
        >
            <form id="intro-form" onSubmit={submit} noValidate>
                {serverError && <Alert tone="error">{serverError}</Alert>}
                <FormGrid>
                    <TextField label="First name" name="first_name" required value={form.first_name} onChange={change} error={errors.first_name} />
                    <TextField label="Last name" name="last_name" required value={form.last_name} onChange={change} error={errors.last_name} />
                    <TextField full label="Title" name="title" value={form.title} onChange={change} placeholder="e.g. Software Engineering Student" />
                    <TextField label="Email" name="email" type="email" required value={form.email} onChange={change} error={errors.email} />
                    <TextField label="Phone" name="phone_number" value={form.phone_number} onChange={change} error={errors.phone_number} placeholder="514-555-0123" />
                    <TextField full label="Location" name="location" value={form.location} onChange={change} placeholder="City, Province" />
                </FormGrid>
            </form>
        </Modal>
    )
}
