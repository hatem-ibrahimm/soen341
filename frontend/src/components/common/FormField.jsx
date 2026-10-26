import { useId } from 'react'
import styles from './FormField.module.css'

// <TextField label="Email" name="email" value=... onChange=... />
// Set multiline for a textarea. `full` makes it span both grid columns.
export function TextField({ label, error, hint, multiline, full, className = '', ...inputProps }) {
    const id = useId()
    const Input = multiline ? 'textarea' : 'input'
    return (
        <div className={`${styles.field} ${full ? styles.full : ''} ${className}`}>
            <label htmlFor={id}>
                {label}
            </label>
            <Input
                id={id}
                className={error ? styles.invalid : ''}
                aria-invalid={Boolean(error)}
                rows={multiline ? 4 : undefined}
                {...inputProps}
            />
            {hint && !error && <small className={styles.hint}>{hint}</small>}
            {error && <small className={styles.error}>{error}</small>}
        </div>
    )
}

export function FormGrid({ children }) {
    return <div className={styles.grid}>{children}</div>
}
