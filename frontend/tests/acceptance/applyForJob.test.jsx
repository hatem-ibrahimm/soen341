// Acceptance tests: Job Application Submission
// "Allow job seekers to apply for a job posting and provide confirmation
//  of successful application submission."
import { screen, within } from '@testing-library/react'
import { renderApp } from '../renderApp.jsx'

describe('Applying for a job', () => {
    test('the application form is pre-filled from the profile', async () => {
        renderApp('/jobs/job-101/apply')

        expect(await screen.findByRole('heading', { name: 'Apply to Northwind Labs' })).toBeInTheDocument()
        expect(screen.getByLabelText(/Email/)).toHaveValue('maya.tremblay@gmail.com')
        expect(screen.getByLabelText(/Phone/)).toHaveValue('514-555-0182')
    })

    test('a phone number is required', async () => {
        const { user } = renderApp('/jobs/job-101/apply')
        await screen.findByRole('heading', { name: 'Apply to Northwind Labs' })

        await user.clear(screen.getByLabelText(/Phone/))
        await user.click(screen.getByRole('button', { name: 'Submit application' }))

        expect(await screen.findByText('Phone number is required.')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Apply to Northwind Labs' })).toBeInTheDocument()
    })

    test('submitting shows a confirmation and the job is then tracked', async () => {
        const { user } = renderApp('/jobs/job-101/apply')
        await screen.findByRole('heading', { name: 'Apply to Northwind Labs' })

        await user.type(screen.getByLabelText(/Why are you a good fit/), 'I build accessible React apps.')
        await user.click(screen.getByRole('button', { name: 'Submit application' }))

        // Confirmation page
        expect(await screen.findByRole('heading', { name: 'Application submitted!' })).toBeInTheDocument()

        // It now appears in "My applications": 13 sample applications + this one,
        // and one more in the "Applied" status
        await user.click(screen.getByRole('link', { name: 'Track my applications' }))
        expect(await screen.findByRole('heading', { level: 3, name: 'Junior Frontend Developer' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /14\s*All/ })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /5\s*Applied/ })).toBeInTheDocument()
    })

    test('a job already applied to shows "Applied" instead of "Apply"', async () => {
        renderApp('/jobs')
        const card = (await screen.findByRole('heading', { level: 2, name: 'React Developer' })).closest('li')

        expect(within(card).getByRole('link', { name: /Applied/ })).toBeInTheDocument()
        expect(within(card).queryByRole('link', { name: 'Apply' })).not.toBeInTheDocument()
    })
})
