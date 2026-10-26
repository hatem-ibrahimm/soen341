import styles from './Button.module.css'

// variant: "primary" | "secondary" | "ghost" | "danger"   size: "md" | "sm"
export default function Button({
    variant = 'primary',
    size = 'md',
    type = 'button',
    className = '',
    children,
    ...rest
}) {
    return (
        <button
            type={type}
            className={`${styles.btn} ${styles[variant]} ${styles[size]} ${className}`}
            {...rest}
        >
            {children}
        </button>
    )
}
