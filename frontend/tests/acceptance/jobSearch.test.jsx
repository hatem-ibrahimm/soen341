// Acceptance tests: Job Search and Job Listing
// "Display available job opportunities, search and filter them by keyword,
//  location or category, and view detailed job descriptions."
import { screen, within } from '@testing-library/react'
import { renderApp } from '../renderApp.jsx'

const jobTitles = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)

describe('Job search and job listing', () => {
    test('a job seeker sees the list of available jobs', async () => {
        renderApp('/jobs')

        expect(await screen.findByRole('heading', { name: 'Find jobs' })).toBeInTheDocument()
        expect(await screen.findByText('15 job(s) found.')).toBeInTheDocument()
        expect(jobTitles()).toContain('Junior Frontend Developer')
        expect(jobTitles()).toContain('UX Designer')
    })

    test('searching by keyword only shows matching jobs', async () => {
        const { user } = renderApp('/jobs')
        await screen.findByText('15 job(s) found.')

        await user.type(screen.getByLabelText('Keywords'), 'designer')
        await user.click(screen.getByRole('button', { name: 'Search' }))

        expect(await screen.findByText('1 job(s) found.')).toBeInTheDocument()
        expect(jobTitles()).toEqual(['UX Designer'])
    })

    test('filtering by location only shows jobs in that place', async () => {
        const { user } = renderApp('/jobs')
        await screen.findByText('15 job(s) found.')

        await user.type(screen.getByLabelText('Location'), 'Sherbrooke')
        await user.click(screen.getByRole('button', { name: 'Search' }))

        expect(await screen.findByText('1 job(s) found.')).toBeInTheDocument()
        expect(jobTitles()).toEqual(['Software Developer Intern'])
    })

    test('filtering by category only shows jobs in that category', async () => {
        const { user } = renderApp('/jobs')
        await screen.findByText('15 job(s) found.')

        await user.type(screen.getByLabelText('Category'), 'Design')
        await user.click(screen.getByRole('button', { name: 'Search' }))

        expect(await screen.findByText('2 job(s) found.')).toBeInTheDocument()
        expect(jobTitles()).toEqual(expect.arrayContaining(['UX Designer', 'UI Developer']))
    })

    test('"Clear All" brings back every job', async () => {
        const { user } = renderApp('/jobs')
        await screen.findByText('15 job(s) found.')

        await user.type(screen.getByLabelText('Keywords'), 'designer')
        await user.click(screen.getByRole('button', { name: 'Search' }))
        await screen.findByText('1 job(s) found.')

        await user.click(screen.getByRole('button', { name: 'Clear All' }))
        expect(await screen.findByText('15 job(s) found.')).toBeInTheDocument()
    })

    test('a job seeker can open a job to read its full description', async () => {
        const { user } = renderApp('/jobs')
        await screen.findByText('15 job(s) found.')

        const card = screen.getByRole('heading', { level: 2, name: 'Junior Frontend Developer' }).closest('li')
        await user.click(within(card).getByRole('link', { name: 'View job details' }))

        expect(await screen.findByRole('heading', { level: 1, name: 'Junior Frontend Developer' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'About the role' })).toBeInTheDocument()
        expect(screen.getByText(/Build accessible React interfaces/)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Apply now' })).toHaveAttribute('href', '/jobs/job-101/apply')
    })
})
