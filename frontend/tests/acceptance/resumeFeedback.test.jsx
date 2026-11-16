// Acceptance tests: AI-Powered Resume Feedback (Sprint 3, #107)
// "Analyze uploaded resumes and provide AI-assisted recommendations."
import { screen, within } from '@testing-library/react'
import { readDb, writeDb } from '../../src/services/mockStore.js'
import { renderApp } from '../renderApp.jsx'

describe('AI resume feedback', () => {
    test('shows the resume that will be reviewed, and no notes yet', async () => {
        renderApp('/resume-feedback')

        expect(await screen.findByRole('heading', { level: 1, name: 'Resume feedback' })).toBeInTheDocument()
        expect(await screen.findByText('Maya_Tremblay_Resume_2026.pdf')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'No notes yet' })).toBeInTheDocument()
    })

    test('requesting a review shows recommendations, areas to improve and strengths', async () => {
        const { user } = renderApp('/resume-feedback')
        await user.click(await screen.findByRole('button', { name: 'Review my resume' }))

        const report = await screen.findByRole('article', { name: 'Maya_Tremblay_Resume_2026.pdf' })
        expect(within(report).getByRole('heading', { name: 'Start here' })).toBeInTheDocument()
        expect(within(report).getByRole('heading', { name: 'Worth a second look' })).toBeInTheDocument()
        expect(within(report).getByRole('heading', { name: 'Already working' })).toBeInTheDocument()
        expect(within(report).getAllByRole('checkbox')).toHaveLength(4)
        expect(screen.getByRole('button', { name: 'Get new feedback' })).toBeInTheDocument()
    })

    test('ticking off a recommendation is remembered when coming back', async () => {
        const { user, unmount } = renderApp('/resume-feedback')
        await user.click(await screen.findByRole('button', { name: 'Review my resume' }))
        const report = await screen.findByRole('article', { name: 'Maya_Tremblay_Resume_2026.pdf' })

        expect(report).toHaveTextContent('0 of 4 done')
        await user.click(within(report).getAllByRole('checkbox')[0])
        expect(report).toHaveTextContent('1 of 4 done')

        // Leave the page and come back: the notes and the tick are still there
        unmount()
        renderApp('/resume-feedback')
        const again = await screen.findByRole('article', { name: 'Maya_Tremblay_Resume_2026.pdf' })
        expect(again).toHaveTextContent('1 of 4 done')
        expect(within(again).getAllByRole('checkbox')[0]).toBeChecked()
    })

    test('the (i) button explains what the feature does', async () => {
        const { user } = renderApp('/resume-feedback')
        await user.click(await screen.findByRole('button', { name: 'What is resume feedback?' }))

        const popup = screen.getByRole('dialog', { name: 'About resume feedback' })
        expect(popup).toHaveTextContent('not shared with employers')

        await user.keyboard('{Escape}')
        expect(screen.queryByRole('dialog', { name: 'About resume feedback' })).not.toBeInTheDocument()
    })

    test('a job seeker without a resume is asked to upload one first', async () => {
        writeDb({ ...readDb(), resumes: [] })
        renderApp('/resume-feedback')

        expect(await screen.findByText(/You haven’t uploaded a resume yet/)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Upload a resume' })).toHaveAttribute('href', '/profile#resumes')
        expect(screen.queryByRole('button', { name: 'Review my resume' })).not.toBeInTheDocument()
    })
})
