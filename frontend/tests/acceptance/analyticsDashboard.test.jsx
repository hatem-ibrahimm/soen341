// Acceptance tests: Application Analytics and History Dashboard (Sprint 3, #106)
// "Job seekers get a dashboard showing their application history, a breakdown
//  of application status, and job-search activity metrics such as
//  applications submitted over time."
import { screen, within } from '@testing-library/react'
import { readDb, writeDb } from '../../src/services/mockStore.js'
import { renderApp } from '../renderApp.jsx'

async function openDashboard() {
    const view = renderApp('/dashboard')
    await screen.findByRole('heading', { name: 'Where things stand' })
    return view
}

const history = () => screen.getByRole('region', { name: 'History' })
// Job titles shown in the history list (each row is a link with the title in bold)
const historyTitles = () => [...history().querySelectorAll('a strong')].map((el) => el.textContent)

describe('Application analytics and history dashboard', () => {
    test('shows the total number of applications and how many got a reply', async () => {
        await openDashboard()
        const summary = screen.getByRole('region', { name: 'Summary' })

        // 13 sample applications; 4 are still "Applied", so 9 got a reply
        expect(within(summary).getByText('13')).toBeInTheDocument()
        expect(summary).toHaveTextContent('9 got a reply')
        expect(summary).toHaveTextContent('69%') // 9 / 13
    })

    test('shows the breakdown of applications by status', async () => {
        await openDashboard()
        const breakdown = screen.getByRole('region', { name: 'Where things stand' })

        const expected = { Applied: '4', 'Under Review': '2', Interview: '2', Offered: '1', Rejected: '4' }
        for (const [status, count] of Object.entries(expected)) {
            const row = within(breakdown).getByRole('button', { name: new RegExp(`^${status}\\s*${count}$`) })
            expect(row).toBeInTheDocument()
        }
    })

    test('shows a chart of applications sent per week, with a time range switch', async () => {
        const { user } = await openDashboard()
        const chart = screen.getByRole('region', { name: 'Applications sent per week' })

        expect(within(chart).getByRole('img', { name: /Column chart of applications per week/ })).toBeInTheDocument()
        expect(chart).toHaveTextContent('in the last 12 weeks')

        await user.click(within(chart).getByRole('button', { name: '6 months' }))
        expect(chart).toHaveTextContent('13 applications in the last 6 months')
    })

    test('lists the full application history, grouped by month', async () => {
        await openDashboard()

        expect(historyTitles()).toHaveLength(13)
        expect(within(history()).getAllByRole('heading', { level: 3 }).length).toBeGreaterThan(0)
    })

    test('clicking a status in the breakdown filters the history', async () => {
        const { user } = await openDashboard()
        const breakdown = screen.getByRole('region', { name: 'Where things stand' })

        await user.click(within(breakdown).getByRole('button', { name: /^Offered/ }))

        expect(historyTitles()).toEqual(['Software Developer Intern'])
    })

    test('the history can be searched by company', async () => {
        const { user } = await openDashboard()

        await user.type(screen.getByRole('searchbox', { name: 'Search application history' }), 'hexa')

        expect(historyTitles()).toEqual(['Software Developer Intern'])
    })

    test('a job seeker with no applications sees an empty state', async () => {
        writeDb({ ...readDb(), applications: [] })
        renderApp('/dashboard')

        expect(await screen.findByText('Nothing to chart yet')).toBeInTheDocument()
        expect(screen.getAllByRole('link', { name: 'Jobs Listings' }).every((link) => link.getAttribute('href') === '/jobs')).toBe(true)
    })
})
