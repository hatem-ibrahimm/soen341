export const PASSWORD_REQUIREMENTS =
    'Only letters and numbers, Must include at least 1 number, Must be shorter than 10 characters.';

export function validatePassword(password) {
    if (typeof password !== 'string' || password.length === 0 ) {
        return 'Enter a password';
    }
    if (!/^[A-Za-z0-9]+$/.test(password)) {
        return 'Your password can contain only letters and numbers. No spaces or special characters.'
    }

    if (!/[0-9]/.test(password)) {
        return 'Your password must contain at least one number.'
    }

    if (password.length >= 10) {
        return 'Your password must be shorter than 10 characters.'
    }
    return ''
}