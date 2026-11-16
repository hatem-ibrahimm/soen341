// Acceptance tests: Application Status Tracking
// "Track application status (Applied, Under Review, Interview, Offered, Rejected)."
import { screen } from '@testing-library/react'
import { renderApp } from '../renderApp.jsx'

const cardTitles = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)

describe('Tracking my applications', () => {
    test('every application is listed with a count per status', async () => {
        renderApp('/applications')

        expect(await screen.findByRole('heading', { level: 1, name: 'My applications' })).toBeInTheDocument()
        expect(await screen.findByRole('tab', { name: /13\s*All/ })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /4\s*Applied/ })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /2\s*Under Review/ })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /2\s*Interview/ })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /1\s*Offered/ })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /4\s*Rejected/ })).toBeInTheDocument()
        expect(cardTitles()).toHaveLength(13)
    })

    test('filtering by a status only shows those applications', async () => {
        const { user } = renderApp('/applications')
        await user.click(await screen.findByRole('tab', { name: /1\s*Offered/ }))

        expect(cardTitles()).toEqual(['Software Developer Intern'])
    })

    test('each application shows the steps of its status', async () => {
        renderApp('/applications')
        await screen.findByRole('heading', { level: 3, name: 'QA Automation Analyst' })

        // The tracker lists every step a job application can go through
        for (const step of ['Applied', 'Under Review', 'Interview', 'Offered']) {
            expect(screen.getAllByText(step).length).toBeGreaterThan(0)
        }
    })
})
