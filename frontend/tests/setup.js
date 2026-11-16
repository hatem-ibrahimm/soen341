// Runs before every test file.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

// Demo mode waits ~250 ms (and up to a few seconds) to imitate a slow network.
// Tests don't need that, so the wait is removed. Everything else in mockStore
// (the sample jobs, applications, resumes...) stays exactly the same.
vi.mock('../src/services/mockStore.js', async (importOriginal) => {
    const original = await importOriginal()
    return {
        ...original,
        delay: (value) => Promise.resolve(structuredClone(value)),
    }
})

// Browser features the app uses that the test browser (jsdom) does not have.
class ResizeObserverStub {
    constructor(callback) {
        this.callback = callback
    }
    observe() {}
    unobserve() {}
    disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? ResizeObserverStub
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {})

// Every test starts from fresh sample data and a logged-in demo user.
beforeEach(() => {
    window.localStorage.clear()
})

afterEach(() => {
    cleanup()
})
