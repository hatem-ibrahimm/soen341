// Acceptance tests: Profile Management
// "Job seekers create and edit their profile: personal information,
//  experience, education, skills and resume."
import { screen, within } from '@testing-library/react'
import { renderApp } from '../renderApp.jsx'

describe('Profile management', () => {
    test('shows personal information, experience, education, skills and resumes', async () => {
        renderApp('/profile')

        expect(await screen.findByRole('heading', { level: 1, name: 'Maya Tremblay' })).toBeInTheDocument()
        for (const section of ['About', 'Experience', 'Education', 'Skills', 'Resumes']) {
            expect(screen.getByRole('heading', { level: 2, name: section })).toBeInTheDocument()
        }
        expect(screen.getByText('Web Developer Intern')).toBeInTheDocument()
        expect(await screen.findByRole('button', { name: 'Maya_Tremblay_Resume_2026.pdf' })).toBeInTheDocument()
    })

    test('a job seeker can edit and save their personal information', async () => {
        const { user } = renderApp('/profile')
        await user.click(await screen.findByRole('button', { name: 'Edit personal info' }))

        const dialog = screen.getByRole('dialog', { name: 'Edit intro' })
        const firstName = within(dialog).getByLabelText(/First name/)
        await user.clear(firstName)
        await user.type(firstName, 'Mayana')
        await user.click(within(dialog).getByRole('button', { name: 'Save' }))

        expect(await screen.findByRole('heading', { level: 1, name: 'Mayana Tremblay' })).toBeInTheDocument()
        expect(screen.queryByRole('dialog', { name: 'Edit intro' })).not.toBeInTheDocument()
    })

    test('the first name cannot be left empty', async () => {
        const { user } = renderApp('/profile')
        await user.click(await screen.findByRole('button', { name: 'Edit personal info' }))

        const dialog = screen.getByRole('dialog', { name: 'Edit intro' })
        await user.clear(within(dialog).getByLabelText(/First name/))
        await user.click(within(dialog).getByRole('button', { name: 'Save' }))

        // The error is shown and the window stays open, so nothing is saved
        expect(await within(dialog).findByText('First name is required.')).toBeInTheDocument()
        expect(screen.getByRole('dialog', { name: 'Edit intro' })).toBeInTheDocument()
    })
})
