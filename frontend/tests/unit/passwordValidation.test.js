// Unit tests: src/utils/passwordValidation.js
// Password rules used on the login and registration pages:
// at least 8 characters, with at least one letter and one number.
import { validatePassword } from '../../src/utils/passwordValidation.js'

describe('validatePassword', () => {
    test('accepts 8+ characters with a letter and a number', () => {
        expect(validatePassword('secret12')).toBe('')
        expect(validatePassword('Secret 12!')).toBe('')
    })
    test('asks for a password when it is empty', () => {
        expect(validatePassword('')).toBe('Enter a password')
        expect(validatePassword(undefined)).toBe('Enter a password')
    })
    test('must be at least 8 characters (7 is too short, 8 is fine)', () => {
        expect(validatePassword('abcdef1')).toMatch(/at least 8 characters/)
        expect(validatePassword('abcdefg1')).toBe('')
    })
    test('requires at least one letter', () => {
        expect(validatePassword('12345678')).toMatch(/at least one letter/)
    })
    test('requires at least one number', () => {
        expect(validatePassword('password')).toMatch(/at least one number/)
    })
})
