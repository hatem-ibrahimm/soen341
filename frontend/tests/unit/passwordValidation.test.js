// Unit tests: src/utils/passwordValidation.js
// Password rules used on the login and registration pages.
import { validatePassword } from '../../src/utils/passwordValidation.js'

describe('validatePassword', () => {
    test('accepts letters and numbers with at least one number, under 10 characters', () => {
        expect(validatePassword('secret12')).toBe('')
        expect(validatePassword('A1')).toBe('')
    })
    test('asks for a password when it is empty', () => {
        expect(validatePassword('')).toBe('Enter a password')
        expect(validatePassword(undefined)).toBe('Enter a password')
    })
    test('rejects spaces and special characters', () => {
        expect(validatePassword('secret 12')).toMatch(/only letters and numbers/)
        expect(validatePassword('secret!2')).toMatch(/only letters and numbers/)
    })
    test('requires at least one number', () => {
        expect(validatePassword('password')).toMatch(/at least one number/)
    })
    test('must be shorter than 10 characters (9 is fine, 10 is not)', () => {
        expect(validatePassword('abcdefgh1')).toBe('')
        expect(validatePassword('abcdefghi1')).toMatch(/shorter than 10 characters/)
    })
})
