// Fake backend kept in localStorage so the UI can be built and demoed
// before the real endpoints exist. Only used when VITE_USE_MOCK_API=true.

import { getToken, saveSession } from './session.js'

const KEY = 'cc_mock_db_v2'
const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001'

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()

// Placeholder jobs until the Job Listing feature (teammate) is merged.
export const MOCK_JOBS = [
    {
        id: 'job-101',
        title: 'Junior Frontend Developer',
        company: 'Northwind Labs',
        location: 'Montréal, QC',
        type: 'Full-time',
        category: 'Software',
        salary: '$65k – $75k',
        posted_at: daysAgo(2),
        description:
            'Build accessible React interfaces for our logistics dashboard. You will work with designers and backend developers to ship features every two weeks.',
    },
    {
        id: 'job-102',
        title: 'Software Engineering Intern (Winter)',
        company: 'Maple Systems',
        location: 'Remote (Canada)',
        type: 'Internship',
        category: 'Software',
        salary: '$28/hr',
        posted_at: daysAgo(5),
        description:
            'Four-month internship on our platform team. Python, PostgreSQL and a bit of everything.',
    },
    {
        id: 'job-103',
        title: 'QA Automation Analyst',
        company: 'Lumen Health',
        location: 'Laval, QC',
        type: 'Full-time',
        category: 'Quality Assurance',
        salary: '$60k – $70k',
        posted_at: daysAgo(9),
        description: 'Write and maintain end-to-end tests with Playwright for our patient portal.',
    },
    {
        id: 'job-104',
        title: 'Data Analyst Co-op',
        company: 'Riverbank Financial',
        location: 'Toronto, ON',
        type: 'Co-op',
        category: 'Data',
        salary: '$25/hr',
        posted_at: daysAgo(12),
        description: 'Turn transaction data into dashboards for the risk team. SQL required.',
    },
    {
        id: 'job-105',
        title: 'UX Designer',
        company: 'Pixel & Pine',
        location: 'Montréal, QC (Hybrid)',
        type: 'Contract',
        category: 'Design',
        salary: '$45/hr',
        posted_at: daysAgo(1),
        description: 'Research, wireframe and prototype flows for a new mobile banking app.',
    },
]

function history(...steps) {
    return steps.map(([status, d]) => ({ status, changed_at: daysAgo(d) }))
}

function seed() {
    return {
        profile: {
            id: DEMO_USER_ID,
            first_name: 'Maya',
            last_name: 'Tremblay',
            title: 'Software Engineering Student',
            email: 'maya.tremblay@gmail.com',
            phone_number: '514-555-0182',
            location: 'Montréal, QC',
            bio: 'Third-year software engineering student who enjoys building clean, accessible web apps. Looking for a winter internship or junior frontend role.',
            avatar_url: '',
            cover_url: '',
        },
        experiences: [
            {
                id: 'exp-1',
                job_title: 'Web Developer Intern',
                company: 'Café Numérique',
                dates: 'May 2025 – Aug 2025',
                description: 'Rebuilt the ordering page in React and cut load time by 40%.',
            },
            {
                id: 'exp-2',
                job_title: 'Teaching Assistant, COMP 248',
                company: 'Concordia University',
                dates: 'Jan 2025 – Apr 2025',
                description: 'Ran weekly labs for 40 students on Java fundamentals.',
            },
        ],
        education: [
            {
                id: 'edu-1',
                school: 'Concordia University',
                degree: 'B.Eng. Software Engineering',
                years: '2023 – 2027',
            },
        ],
        skills: ['React', 'JavaScript', 'Python', 'SQL', 'Git', 'Figma'],
        resumes: [
            {
                id: 'res-1',
                file_name: 'Maya_Tremblay_Resume_2026.pdf',
                file_size: 184320,
                uploaded_at: daysAgo(14),
                is_default: true,
                file_url: '',
            },
            {
                id: 'res-2',
                file_name: 'Maya_Tremblay_Resume_Design.pdf',
                file_size: 221184,
                uploaded_at: daysAgo(30),
                is_default: false,
                file_url: '',
            },
        ],
        applications: [
            {
                id: '3f9c2a71-5b8e-4d20-9a61-0c7e4b2d8f13',
                job_id: 'job-103',
                resume_id: 'res-1',
                cover_letter: '',
                status: 'Interview',
                applied_at: daysAgo(8),
                status_history: history(['Applied', 8], ['Under Review', 6], ['Interview', 2]),
            },
            {
                id: 'b7d41e09-2c6a-4f8b-8e35-91a0d6c4e2f7',
                job_id: 'job-104',
                resume_id: 'res-1',
                cover_letter: '',
                status: 'Rejected',
                applied_at: daysAgo(11),
                status_history: history(['Applied', 11], ['Under Review', 9], ['Rejected', 4]),
            },
            {
                id: '58e0c3b2-7f19-4a6d-b2c8-e4f1a9d07c55',
                job_id: 'job-102',
                resume_id: 'res-1',
                cover_letter: '',
                status: 'Under Review',
                applied_at: daysAgo(4),
                status_history: history(['Applied', 4], ['Under Review', 1]),
            },
        ],
    }
}

let memoryDb = null // used when localStorage is unavailable

export function readDb() {
    try {
        const raw = window.localStorage.getItem(KEY)
        if (raw) return JSON.parse(raw)
    } catch {
        /* fall through */
    }
    if (memoryDb) return structuredClone(memoryDb)
    const db = seed()
    writeDb(db)
    return db
}

export function writeDb(db) {
    memoryDb = structuredClone(db)
    try {
        window.localStorage.setItem(KEY, JSON.stringify(db))
    } catch {
        /* storage full or blocked: keep working in memory */
    }
}

export function resetDb() {
    writeDb(seed())
}

export function ensureDemoSession() {
    if (!getToken()) saveSession('mock-token', DEMO_USER_ID)
}

export const newId = (prefix) =>
    prefix === 'app' ? crypto.randomUUID() : `${prefix}-${Math.random().toString(36).slice(2, 9)}`

// Simulate network latency so loading states are visible.
export const delay = (value, ms = 250) =>
    new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), ms))

// Read a File as a data URL so mock uploads survive a page refresh.
// Bigger files get a temporary URL that only lasts until the page is reloaded.
export function fileToDataUrl(file) {
    return new Promise((resolve) => {
        if (file.size > 1.5 * 1024 * 1024) return resolve(URL.createObjectURL(file))
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => resolve('')
        reader.readAsDataURL(file)
    })
}
