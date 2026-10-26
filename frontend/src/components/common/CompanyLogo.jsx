// Placeholder logo: first letter of the company on a colour picked from its name.
const COLORS = ['#2f3b5f', '#2e7d5b', '#9a5b00', '#5b4a9b', '#d14334', '#2c6e7f']

export default function CompanyLogo({ name = '', size = 48 }) {
    const color = COLORS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % COLORS.length]
    return (
        <span
            aria-hidden="true"
            style={{
                width: size,
                height: size,
                borderRadius: 8,
                background: `${color}18`,
                color,
                fontWeight: 800,
                fontSize: size * 0.42,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
            }}
        >
            {name.charAt(0).toUpperCase() || '?'}
        </span>
    )
}
