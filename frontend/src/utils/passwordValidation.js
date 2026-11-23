export const PASSWORD_REQUIREMENTS =
    'Use at least 8 characters and include at least one letter and one number.';

export function validatePassword(password) {
    if (typeof password !== 'string' || password.length === 0) {
        return 'Enter a password';
    }
    if (password.length < 8) {
        return 'Your password must be at least 8 characters long.'
    }
    if (!/[A-Za-z]/.test(password)) {
        return 'Your password must contain at least one letter.'
    }
    if (!/[0-9]/.test(password)) {
        return 'Your password must contain at least one number.'
    }
    return ''
}