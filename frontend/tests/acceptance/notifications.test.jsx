// Acceptance tests: Application status notifications (Sprint 3)
// Job seekers see updates about their applications and can mark them as read.
import { screen, waitFor } from '@testing-library/react'
import { renderApp } from '../renderApp.jsx'

const navLink = () => screen.getByRole('link', { name: /^Notifications/ })

describe('Notifications', () => {
    test('status updates are listed, with the unread count in the top bar', async () => {
        renderApp('/notifications')

        expect(await screen.findByRole('heading', { level: 1, name: 'Notifications' })).toBeInTheDocument()
        expect((await screen.findAllByRole('heading', { name: 'Application Status Updated' })).length).toBeGreaterThan(0)
        await waitFor(() => expect(navLink()).toHaveTextContent('15'))
    })

    test('marking a notification as read lowers the unread count', async () => {
        const { user } = renderApp('/notifications')
        await waitFor(() => expect(navLink()).toHaveTextContent('15'))

        const [first] = await screen.findAllByRole('button', { name: 'Mark as read' })
        await user.click(first)

        await waitFor(() => expect(navLink()).toHaveTextContent('14'))
    })

    test('deleting a notification removes it from the list', async () => {
        const { user } = renderApp('/notifications')
        await waitFor(() => expect(navLink()).toHaveTextContent('14'))

        const statusUpdates = await screen.findAllByRole('heading', {
            name: 'Application Status Updated',
        })
        const beforeCount = statusUpdates.length
        await user.click(screen.getAllByRole('button', { name: /^Delete notification:/ })[0])

        await waitFor(() => {
            expect(screen.queryAllByRole('heading', {
                name: 'Application Status Updated',
            })).toHaveLength(beforeCount - 1)
        })
        await waitFor(() => expect(navLink()).toHaveTextContent('14'))
    })
})
