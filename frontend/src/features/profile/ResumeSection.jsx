import { useRef, useState } from 'react'
import { Alert, Button, Card, FilePicker, Modal } from '../../components/common'
import useResumes from '../../hooks/useResumes.js'
import { formatDate, formatFileSize } from '../../services/format.js'
import { MULTIPLE_RESUMES, RESUME_ACCEPT } from '../../services/resumeApi.js'
import styles from './ProfilePage.module.css'

const ACCEPT = RESUME_ACCEPT

// Upload, replace, delete, view, and choose a default resume.
export default function ResumeSection() {
    const { resumes, loading, error, setError, busyId, upload, replace, makeDefault, remove } = useResumes()
    const replaceInput = useRef(null)
    const [replaceId, setReplaceId] = useState(null)
    const [confirmDelete, setConfirmDelete] = useState(null)
    const [notice, setNotice] = useState('')

    function flash(msg) {
        setNotice(msg)
        setTimeout(() => setNotice(''), 2500)
    }

    async function handleUpload(file) {
        if (await upload(file)) flash(`Uploaded ${file.name}`)
    }

    function startReplace(id) {
        setReplaceId(id)
        replaceInput.current?.click()
    }

    async function handleReplace(e) {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (file && replaceId && (await replace(replaceId, file))) flash('Resume replaced')
    }

    function view(r) {
        if (r.file_url) window.open(r.file_url, '_blank', 'noopener')
        else setError('Preview is not available for this file yet.')
    }

    return (
        <Card id="resumes" title="Resumes">
            <p className={styles.sectionHint}>
                 {MULTIPLE_RESUMES
                    ? <>Your <strong>default</strong> resume is pre-selected when you apply to a job. PDF or DOC, up to 5 MB.</>
                    : <>This resume is used when you apply to a job. PDF or DOC, up to 5 MB.</>}
            </p>

            {notice && <Alert tone="success">{notice}</Alert>}
            {error && <Alert tone="error">{error}</Alert>}

            {loading ? (
                <p className={styles.placeholder}>Loading resumes…</p>
            ) : (
                <ul className={styles.resumeList}>
                    {resumes.map((r) => (
                        <li key={r.id} className={styles.resume}>
                            <span className={styles.fileIcon} aria-hidden="true">
                                {/\.pdf$/i.test(r.file_name) ? 'PDF' : 'DOC'}
                            </span>
                            <div className={styles.resumeInfo}>
                                <button className={styles.resumeName} onClick={() => view(r)}>
                                    {r.file_name}
                                </button>
                                <span className={styles.entryMeta}>
                                    {formatFileSize(r.file_size)} · Uploaded {formatDate(r.uploaded_at)}
                                </span>
                            </div>
                            {!MULTIPLE_RESUMES ? null : r.is_default ? (
                                <span className={styles.defaultTag}>Default</span>
                            ) : (
                                <Button size="sm" variant="ghost" onClick={() => makeDefault(r.id)} disabled={busyId === r.id}>
                                    Set default
                                </Button>
                            )}
                            <div className={styles.resumeActions}>
                                <Button size="sm" variant="ghost" onClick={() => startReplace(r.id)} disabled={busyId === r.id}>
                                    {busyId === r.id ? 'Working…' : 'Replace'}
                                </Button>
                                <Button size="sm" variant="danger" onClick={() => setConfirmDelete(r)} disabled={busyId === r.id}>
                                    Delete
                                </Button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {(MULTIPLE_RESUMES || resumes.length === 0) && <FilePicker
                accept={ACCEPT}
                onSelect={handleUpload}
                disabled={busyId === 'new'}
                label={busyId === 'new' ? 'Uploading…' : resumes.length ? 'Upload another resume' : 'Upload your resume'}
                hint="Drag & drop or click to browse · PDF, DOC"
            />}
            <input ref={replaceInput} type="file" accept={ACCEPT} hidden onChange={handleReplace} />

            {confirmDelete && (
                <Modal
                    title="Delete resume?"
                    width={440}
                    onClose={() => setConfirmDelete(null)}
                    footer={
                        <>
                            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                            <Button
                                onClick={async () => {
                                    await remove(confirmDelete.id)
                                    setConfirmDelete(null)
                                    flash('Resume deleted')
                                }}
                                style={{ background: 'var(--cc-danger)' }}
                            >
                                Delete
                            </Button>
                        </>
                    }
                >
                    <p style={{ margin: 0 }}>
                        <strong>{confirmDelete.file_name}</strong> will be removed from your profile. Applications you already sent keep their copy.
                    </p>
                </Modal>
            )}
        </Card>
    )
}
