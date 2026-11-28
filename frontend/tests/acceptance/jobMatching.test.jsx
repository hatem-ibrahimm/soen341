// Acceptance tests: AI Job Matching Suggestions (Sprint 4)
// "Recommend relevant jobs based on user profiles and resumes."
import { screen, within } from '@testing-library/react'
import { readDb, writeDb } from '../../src/services/mockStore.js'
import { renderApp } from '../renderApp.jsx'

async function runMatching(user) {
    await user.click(await screen.findByRole('button', { name: 'Find my matches' }))
    return screen.findByRole('list', { name: 'Recommended jobs' })
}

describe('AI job matching', () => {
    test('the Job matches page can be reached from the profile menu', async () => {
        const { user } = renderApp('/jobs')
        await user.click(await screen.findByRole('button', { name: 'Open profile menu' }))
        await user.click(screen.getByRole('menuitem', { name: 'Job matches' }))

        expect(await screen.findByRole('heading', { level: 1, name: 'Job matches' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'No matches yet' })).toBeInTheDocument()
    })

    test('shows what the matcher will use from the profile and resume', async () => {
        renderApp('/matches')

        const inputs = await screen.findByRole('region', { name: 'What we match on' })
        expect(await within(inputs).findByText('6 skills')).toBeInTheDocument()
        expect(within(inputs).getByText('2 roles')).toBeInTheDocument()
        expect(within(inputs).getByText('Maya_Tremblay_Resume_2026.pdf')).toBeInTheDocument()
        expect(within(inputs).getByText('5 of 5 filled in')).toBeInTheDocument()
    })

    test('finding matches shows ranked jobs with a score, the reason and the skills', async () => {
        const { user } = renderApp('/matches')
        const list = await runMatching(user)

        const cards = within(list).getAllByRole('article')
        expect(cards).toHaveLength(5)
        expect(cards[0]).toHaveAccessibleName('Junior Frontend Developer')
        expect(within(cards[0]).getByLabelText('Strong match, 91% match')).toHaveTextContent('Strong match · 91%')
        expect(within(cards[0]).getByText('Why it fits')).toBeInTheDocument()
        expect(within(within(cards[0]).getByRole('list', { name: 'Skills you have' })).getByText('React')).toBeInTheDocument()
        expect(within(within(cards[0]).getByRole('list', { name: 'Skills to learn' })).getByText('TypeScript')).toBeInTheDocument()

        // Best match first
        expect(cards[4]).toHaveAccessibleName('UX Designer')
        expect(within(cards[4]).getByLabelText('Worth a look, 52% match')).toHaveTextContent('Worth a look · 52%')

        const summary = screen.getAllByRole('status').find((el) => el.textContent.includes('open postings'))
        expect(summary).toHaveTextContent(/^5 matches from 15 open postings/)
        expect(screen.getByText(/based on your profile and resume/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Refresh matches' })).toBeInTheDocument()
    })

    test('each match links to the job and to apply, or shows it is already applied to', async () => {
        const { user } = renderApp('/matches')
        const list = await runMatching(user)

        const notApplied = within(list).getByRole('article', { name: 'Junior Frontend Developer' })
        expect(within(notApplied).getByRole('link', { name: 'View job' })).toHaveAttribute('href', '/jobs/job-101')
        expect(within(notApplied).getByRole('link', { name: 'Apply' })).toHaveAttribute('href', '/jobs/job-101/apply')

        // The demo user already applied to job-106
        const applied = within(list).getByRole('article', { name: 'Frontend Developer Intern' })
        expect(within(applied).getByRole('link', { name: 'Applied ✓' })).toHaveAttribute('href', '/applications')
    })

    test('jobs already applied to can be hidden', async () => {
        const { user } = renderApp('/matches')
        const list = await runMatching(user)
        expect(within(list).getAllByRole('article')).toHaveLength(5)

        await user.click(screen.getByRole('checkbox', { name: /Hide jobs I’ve applied to/ }))
        const remaining = within(screen.getByRole('list', { name: 'Recommended jobs' })).getAllByRole('article')
        expect(remaining.map((c) => c.getAttribute('aria-labelledby'))).toEqual(['match-job-101', 'match-job-105'])
    })

    test('skills missing across several matches are summed up', async () => {
        const { user } = renderApp('/matches')
        await runMatching(user)

        const gaps = screen.getByRole('region', { name: 'Skills you’re missing most' })
        const first = within(gaps).getAllByRole('listitem')[0]
        expect(first).toHaveTextContent('TypeScript')
        expect(first).toHaveTextContent('3 of 5 matches')
    })

    test('matches are still there when coming back to the page', async () => {
        const { user, unmount } = renderApp('/matches')
        await runMatching(user)
        unmount()

        renderApp('/matches')
        const list = await screen.findByRole('list', { name: 'Recommended jobs' })
        expect(within(list).getAllByRole('article')).toHaveLength(5)
        expect(screen.queryByRole('button', { name: 'Find my matches' })).not.toBeInTheDocument()
    })

    test('without a resume, matches are based on the profile and the user is told', async () => {
        writeDb({ ...readDb(), resumes: [] })
        const { user } = renderApp('/matches')
        await runMatching(user)

        expect(screen.getByText(/No resume uploaded\. Recommendations are based on your profile\./)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Upload a resume' })).toHaveAttribute('href', '/profile#resumes')
        expect(screen.getByText(/based on your profile ·/)).toBeInTheDocument()
    })

    test('an empty profile with no resume is asked to fill in the profile first', async () => {
        const db = readDb()
        writeDb({
            ...db,
            profile: { ...db.profile, title: '', bio: '' },
            skills: [],
            experiences: [],
            education: [],
            resumes: [],
        })
        const { user } = renderApp('/matches')
        await user.click(await screen.findByRole('button', { name: 'Find my matches' }))

        const alert = await screen.findByRole('alert')
        expect(alert).toHaveTextContent('Add a few skills or some experience to your profile')
        expect(within(alert).getByRole('link', { name: 'Go to your profile' })).toHaveAttribute('href', '/profile')
        expect(screen.queryByRole('list', { name: 'Recommended jobs' })).not.toBeInTheDocument()
    })

    test('the Jobs Listings page points to job matches', async () => {
        renderApp('/jobs')
        expect(await screen.findByText('See the jobs that best fit your profile and resume.')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'View my matches' })).toHaveAttribute('href', '/matches')
    })
})
