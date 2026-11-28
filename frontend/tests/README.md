# Frontend tests

There are two kinds of tests:

- **Unit tests** (`unit/`): each one checks a single function on its own, with no
  page involved. Example: "a password without a number is rejected", or
  "9 replies out of 13 applications is a 69% reply rate".
- **Acceptance tests** (`acceptance/`): each one checks that a user story works
  from the user's point of view (open a page, type, click, see the result).
  They run the real React app in a simulated browser, in **demo mode**, so they
  use the sample data in `src/services/mockStore.js`. No backend or database is
  needed.

## Running them

From the `frontend` folder:

```bash
npm test                  # run every test once (unit + acceptance)
npm run test:unit         # only the unit tests
npm run test:acceptance   # only the acceptance tests
npm run test:watch        # keep running and re-test whenever you save a file
```

## Automatic checks on GitHub (CI)

`.github/workflows/frontend-tests.yml` makes GitHub run, on every push that changes
`frontend/` and on every pull request into `develop` or `main`:

1. `npm run lint`
2. `npm run test:unit`
3. `npm run test:acceptance`
4. `npm run build`

The result shows as ✅ or ❌ on the commit and on the pull request
(**Actions** tab on GitHub for the details).

## Files

| File | What it is |
|---|---|
| `unit/*.test.js` | Unit tests, one file per source file they test |
| `acceptance/*.test.jsx` | Acceptance tests, one file per feature |
| `renderApp.jsx` | Opens the app at a page, logged in as the demo user |
| `setup.js` | Runs before the tests (fresh sample data each test, no fake network delay) |
| `../vitest.config.js` | Test settings |

## Adding a unit test

Put it in `unit/`, named after the file it tests (`src/utils/foo.js` -> `unit/foo.test.js`):

```js
import { validatePassword } from '../../src/utils/passwordValidation.js'

test('requires at least one number', () => {
    expect(validatePassword('password')).toMatch(/at least one number/)
})
```

## Adding an acceptance test

Copy a test from a file in `acceptance/` and change it. A test usually:

1. opens a page: `const { user } = renderApp('/jobs')`
2. waits for it to load: `await screen.findByRole('heading', { name: 'Find jobs' })`
3. does something: `await user.click(screen.getByRole('button', { name: 'Search' }))`
4. checks the result: `expect(screen.getByText('1 job(s) found.')).toBeInTheDocument()`

If you change text on a page (a button label, a heading...), a test that looks for
the old text will fail. Update the test to the new text in the same pull request.
