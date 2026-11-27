// Acceptance tests: Recruiter job postings
// Recruiters create job postings and manage the postings they own.
import { screen, within } from '@testing-library/react'
import { beforeEach } from 'vitest'
import { resetDb } from '../../src/services/mockStore.js'
import { saveSession } from '../../src/services/session.js'
import { renderApp } from '../renderApp.jsx'

describe('Recruiter job postings', () => {
    beforeEach(() => {
        resetDb()
    })

    test('a recruiter sees the postings they manage', async () => {
        renderApp('/recruiter')

        expect(await screen.findByRole('heading', { level: 1, name: 'Recruiter dashboard' })).toBeInTheDocument()
        expect(await screen.findByRole('heading', { level: 3, name: 'Junior Frontend Developer' })).toBeInTheDocument()
    })

    test('a recruiter can edit and save a job posting', async () => {
        const { user } = renderApp('/recruiter')
        const postingTitle = await screen.findByRole('heading', { level: 3, name: 'Junior Frontend Developer' })
        const posting = postingTitle.closest('li')

        await user.click(within(posting).getByRole('button', { name: 'Edit' }))
        const titleInput = await screen.findByLabelText('Job title')
        expect(titleInput).toHaveValue('Junior Frontend Developer')
        await user.clear(titleInput)
        await user.type(titleInput, 'Senior Frontend Developer')
        await user.click(screen.getByRole('button', { name: 'Save changes' }))

        expect(await screen.findByText('Your job posting has been updated.')).toBeInTheDocument()
        expect(await screen.findByRole('heading', { level: 3, name: 'Senior Frontend Developer' })).toBeInTheDocument()
    })

    test('a recruiter can save a new job posting as a draft', async () => {
        const { user } = renderApp('/recruiter')
        await screen.findByRole('heading', { level: 3, name: 'Junior Frontend Developer' })

        await user.click(screen.getByRole('button', { name: /Create a job listing/ }))
        await user.selectOptions(screen.getByLabelText('Publication status'), 'draft')
        await user.type(screen.getByLabelText('Job title'), 'Mobile Developer')
        await user.clear(screen.getByLabelText('Company'))
        await user.type(screen.getByLabelText('Company'), 'Northwind Labs')
        await user.type(screen.getByLabelText('Location'), 'Montréal, QC')
        await user.type(screen.getByLabelText('Category'), 'Software')
        await user.type(screen.getByLabelText('Job description'), 'Build our iOS and Android apps with React Native.')
        await user.click(screen.getByRole('button', { name: 'Save draft' }))

        expect(await screen.findByText(/Your draft has been saved/)).toBeInTheDocument()
        const posting = (await screen.findByRole('heading', { level: 3, name: 'Mobile Developer' })).closest('li')
        expect(within(posting).getByText('draft')).toBeInTheDocument()
    })

    test('a new published posting appears in job search', async () => {
        const { user } = renderApp('/recruiter')
        await screen.findByRole('heading', { level: 3, name: 'Junior Frontend Developer' })

        await user.click(screen.getByRole('button', { name: /Create a job listing/ }))
        expect(screen.getByLabelText('Publication status')).toHaveValue('published')
        await user.type(screen.getByLabelText('Job title'), 'Mobile Developer')
        await user.clear(screen.getByLabelText('Company'))
        await user.type(screen.getByLabelText('Company'), 'Northwind Labs')
        await user.type(screen.getByLabelText('Location'), 'Montréal, QC')
        await user.type(screen.getByLabelText('Category'), 'Software')
        await user.type(screen.getByLabelText('Job description'), 'Build our iOS and Android apps with React Native.')
        await user.click(screen.getByRole('button', { name: 'Publish job posting' }))

        expect(await screen.findByText('Your job posting is published and visible in job search.')).toBeInTheDocument()
        await user.click(screen.getByRole('link', { name: 'Jobs Listings' }))
        expect(await screen.findByRole('heading', { level: 2, name: 'Mobile Developer' })).toBeInTheDocument()
    })

    test('a job seeker cannot open the recruiter dashboard', async () => {
        saveSession('job-seeker-token', '00000000-0000-4000-8000-000000000001', 'job_seeker')
        renderApp('/recruiter', { loggedIn: false })
        expect(await screen.findByRole('heading', { name: 'Jobs Listings' })).toBeInTheDocument()
    })
})
