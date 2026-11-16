// Fake backend kept in localStorage so the UI can be built and demoed
// before the real endpoints exist. Only used when VITE_USE_MOCK_API=true.

import { getToken, saveSession } from './session.js'

// v3: Sprint 3 added more sample jobs/applications for the analytics dashboard.
const KEY = 'cc_mock_db_v3'
const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001'
const MOCK_RESUME_URL =
    'data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA0IDAgUiA+PiA+PiAvQ29udGVudHMgNSAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iago1IDAgb2JqCjw8IC9MZW5ndGggNjAgPj4Kc3RyZWFtCkJUIC9GMSAxOCBUZiA1MCA3MDAgVGQgKE1heWEgVHJlbWJsYXkgLSBTYW1wbGUgUmVzdW1lKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDI0MSAwMDAwMCBuIAowMDAwMDAwMzExIDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgNiAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKNDIxCiUlRU9GCg=='
const MOCK_RESUME_IDS = new Set(['res-1', 'res-2'])

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
    {
        id: 'job-106',
        title: 'Frontend Developer Intern',
        company: 'Larkspur Commerce',
        location: 'Montréal, QC',
        type: 'Internship',
        category: 'Software',
        salary: '$26/hr',
        posted_at: daysAgo(3),
        description: 'Help build the merchant admin in React and TypeScript. Pair programming every day.',
    },
    {
        id: 'job-107',
        title: 'React Developer',
        company: 'Bluefin Analytics',
        location: 'Remote (Canada)',
        type: 'Full-time',
        category: 'Software',
        salary: '$70k – $82k',
        posted_at: daysAgo(6),
        description: 'Own charts and reporting screens in a data product used by 300 clients.',
    },
    {
        id: 'job-108',
        title: 'Junior Full-Stack Developer',
        company: 'Oakridge Software',
        location: 'Ottawa, ON',
        type: 'Full-time',
        category: 'Software',
        salary: '$62k – $72k',
        posted_at: daysAgo(24),
        description: 'Node, React and PostgreSQL on an internal scheduling tool.',
    },
    {
        id: 'job-109',
        title: 'Web Developer Co-op',
        company: 'Saint-Laurent Transit Co.',
        location: 'Montréal, QC',
        type: 'Co-op',
        category: 'Software',
        salary: '$24/hr',
        posted_at: daysAgo(19),
        description: 'Maintain the trip planner website and improve its accessibility.',
    },
    {
        id: 'job-110',
        title: 'Software Developer Intern',
        company: 'Hexa Robotics',
        location: 'Sherbrooke, QC',
        type: 'Internship',
        category: 'Software',
        salary: '$27/hr',
        posted_at: daysAgo(38),
        description: 'Write tooling in Python for the robot fleet dashboard.',
    },
    {
        id: 'job-111',
        title: 'UI Developer',
        company: 'Cedar & Co. Studio',
        location: 'Montréal, QC (Hybrid)',
        type: 'Contract',
        category: 'Design',
        salary: '$40/hr',
        posted_at: daysAgo(44),
        description: 'Turn Figma designs into clean, responsive pages for client websites.',
    },
    {
        id: 'job-112',
        title: 'Junior QA Engineer',
        company: 'Polar Bear Games',
        location: 'Québec City, QC',
        type: 'Full-time',
        category: 'Quality Assurance',
        salary: '$55k – $63k',
        posted_at: daysAgo(28),
        description: 'Test new game builds and write automated smoke tests.',
    },
    {
        id: 'job-113',
        title: 'Frontend Engineer, Accessibility',
        company: 'Brightline Learning',
        location: 'Remote (Canada)',
        type: 'Full-time',
        category: 'Software',
        salary: '$72k – $85k',
        posted_at: daysAgo(15),
        description: 'Make our course player usable with screen readers and keyboards.',
    },
    {
        id: 'job-114',
        title: 'Software Engineer, New Grad',
        company: 'Gatineau Cloud',
        location: 'Gatineau, QC',
        type: 'Full-time',
        category: 'Software',
        salary: '$78k – $88k',
        posted_at: daysAgo(56),
        description: 'Rotate through three platform teams during your first year.',
    },
    {
        id: 'job-115',
        title: 'Junior Developer',
        company: 'Tidewater Logistics',
        location: 'Halifax, NS (Remote OK)',
        type: 'Full-time',
        category: 'Software',
        salary: '$58k – $66k',
        posted_at: daysAgo(9),
        description: 'Small team, lots of ownership: shipment tracking pages and APIs.',
    },
]

const MOCK_JOB_IDS = new Set(MOCK_JOBS.map((job) => String(job.id)))

function history(...steps) {
    return steps.map(([status, d]) => ({ status, changed_at: daysAgo(d) }))
}

// Shorthand for a sample application: app(id, jobId, currentStatus, ...[status, daysAgo])
function app(id, jobId, status, ...steps) {
    return {
        id,
        job_id: jobId,
        resume_id: 'res-1',
        cover_letter: '',
        status,
        applied_at: daysAgo(steps[0][1]),
        status_history: history(...steps),
    }
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
                file_url: MOCK_RESUME_URL,
            },
            {
                id: 'res-2',
                file_name: 'Maya_Tremblay_Resume_Design.pdf',
                file_size: 221184,
                uploaded_at: daysAgo(30),
                is_default: false,
                file_url: MOCK_RESUME_URL,
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
            // Sprint 3: extra history so the analytics dashboard has something to show.
            app('c1a2e3f4-1111-4a6d-9c01-0a0000000106', 'job-106', 'Applied', ['Applied', 1]),
            app('c1a2e3f4-1111-4a6d-9c01-0a0000000107', 'job-107', 'Applied', ['Applied', 3]),
            app('c1a2e3f4-1111-4a6d-9c01-0a0000000115', 'job-115', 'Applied', ['Applied', 6]),
            app('c1a2e3f4-1111-4a6d-9c01-0a0000000113', 'job-113', 'Under Review', ['Applied', 13], ['Under Review', 9]),
            app('c1a2e3f4-1111-4a6d-9c01-0a0000000109', 'job-109', 'Interview', ['Applied', 16], ['Under Review', 12], ['Interview', 6]),
            app('c1a2e3f4-1111-4a6d-9c01-0a0000000108', 'job-108', 'Rejected', ['Applied', 20], ['Rejected', 13]),
            app('c1a2e3f4-1111-4a6d-9c01-0a0000000112', 'job-112', 'Applied', ['Applied', 25]),
            app('c1a2e3f4-1111-4a6d-9c01-0a0000000110', 'job-110', 'Offered', ['Applied', 34], ['Under Review', 30], ['Interview', 24], ['Offered', 10]),
            app('c1a2e3f4-1111-4a6d-9c01-0a0000000111', 'job-111', 'Rejected', ['Applied', 41], ['Rejected', 30]),
            app('c1a2e3f4-1111-4a6d-9c01-0a0000000114', 'job-114', 'Rejected', ['Applied', 52], ['Under Review', 49], ['Rejected', 45]),
        ],
        jobs: MOCK_JOBS.map((job) => ({
            ...job,
            recruiter_id: DEMO_USER_ID,
        })),
    }
}

function addDemoRecruiterOwnership(db) {
    if (db.profile?.id !== DEMO_USER_ID) return db

    let changed = false
    db.jobs = (db.jobs ?? MOCK_JOBS).map((job) => {
        if (MOCK_JOB_IDS.has(String(job.id)) && !job.recruiter_id) {
            changed = true
            return { ...job, recruiter_id: DEMO_USER_ID }
        }
        return job
    })
    db.resumes = (db.resumes ?? []).map((resume) => {
        if (MOCK_RESUME_IDS.has(String(resume.id)) && !resume.file_url) {
            changed = true
            return { ...resume, file_url: MOCK_RESUME_URL }
        }
        return resume
    })
    if (changed) writeDb(db)
    return db
}

let memoryDb = null // used when localStorage is unavailable

export function readDb() {
    try {
        const raw = window.localStorage.getItem(KEY)
        if (raw) return addDemoRecruiterOwnership(JSON.parse(raw))
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
    if (!getToken() || getToken() === 'mock-token') {
        saveSession('mock-token', DEMO_USER_ID, 'recruiter', 'Northwind Labs')
    }
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
