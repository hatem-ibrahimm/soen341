import styles from './Avatar.module.css'

// Shows the profile picture, or the user's initials when there is none.
export default function Avatar({ firstName = '', lastName = '', src, size = 40, className = '' }) {
    const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '?'
    return (
        <span
            className={`${styles.avatar} ${className}`}
            style={{ width: size, height: size, fontSize: size * 0.38 }}
            aria-hidden="true"
        >
            {src ? <img src={src} alt="" /> : initials}
        </span>
    )
}
