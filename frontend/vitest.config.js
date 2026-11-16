import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.js'

// Settings for the automated frontend tests (`npm test`).
// The tests run the real React app in a simulated browser (jsdom), in demo
// mode, so they use the sample data in mockStore.js and need no backend.
export default mergeConfig(
    viteConfig,
    defineConfig({
        test: {
            environment: 'jsdom',
            globals: true,
            setupFiles: ['./tests/setup.js'],
            include: ['tests/**/*.test.{js,jsx}'],
            env: { VITE_USE_MOCK_API: 'true' },
            // A whole page renders in each test, so give slow CI machines time.
            testTimeout: 15000,
        },
    }),
)
