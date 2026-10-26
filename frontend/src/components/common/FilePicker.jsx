import { useRef, useState } from 'react'
import styles from './FilePicker.module.css'

// Drag-and-drop or click-to-browse file input.
// onSelect(file) is called with the chosen File.
export default function FilePicker({ accept, onSelect, label = 'Drop a file here or browse', hint, disabled }) {
    const inputRef = useRef(null)
    const [dragging, setDragging] = useState(false)

    function handleFiles(files) {
        if (files && files[0]) onSelect(files[0])
    }

    return (
        <div
            className={`${styles.drop} ${dragging ? styles.dragging : ''} ${disabled ? styles.disabled : ''}`}
            onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                if (!disabled) handleFiles(e.dataTransfer.files)
            }}
            onClick={() => !disabled && inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        >
            <span className={styles.icon} aria-hidden="true">⇪</span>
            <span className={styles.label}>{label}</span>
            {hint && <span className={styles.hint}>{hint}</span>}
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                hidden
                onChange={(e) => {
                    handleFiles(e.target.files)
                    e.target.value = ''
                }}
            />
        </div>
    )
}
