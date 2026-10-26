export const JOBS_DATA_MODE = 'mock'

const JOBS = [
    {
        id: 'frontend-engineer-northstar',
        title: 'Frontend Engineer',
        company_name: 'Northstar Labs',
        location: 'Montreal, QC',
        category: 'Engineering',
        salary_min: 90000,
        salary_max: 125000,
        company_description:
            'Northstar Labs builds accessible tools for teams working across the web.',
        description:
            'Build and maintain responsive interfaces with a product-focused engineering team.',
        required_skills: ['React', 'JavaScript', 'Accessibility'],
    },
    {
        id: 'product-designer-maple',
        title: 'Product Designer',
        company_name: 'Maple Works',
        location: 'Toronto, ON',
        category: 'Design',
        salary_min: 80000,
        salary_max: 110000,
        company_description:
            'Maple Works helps small businesses organize their day-to-day operations.',
        description:
            'Research user needs and turn them into clear, thoughtful product experiences.',
        required_skills: ['Figma', 'User research', 'Prototyping'],
    },
    {
        id: 'backend-developer-cedar',
        title: 'Backend Developer',
        company_name: 'Cedar Systems',
        location: 'Remote',
        category: 'Engineering',
        salary_min: 100000,
        salary_max: 145000,
        company_description:
            'Cedar Systems creates dependable data services for growing businesses.',
        description:
            'Design APIs and services, improve reliability, and collaborate across product teams.',
        required_skills: ['Python', 'REST APIs', 'PostgreSQL'],
    },
    {
        id: 'data-analyst-lantern',
        title: 'Data Analyst',
        company_name: 'Lantern Analytics',
        location: 'Vancouver, BC',
        category: 'Data',
        salary_min: 75000,
        salary_max: 105000,
        company_description:
            'Lantern Analytics turns complex information into practical business insights.',
        description:
            'Explore datasets, communicate findings, and help teams make informed decisions.',
        required_skills: ['SQL', 'Python', 'Data visualization'],
    },
    {
        id: 'full-stack-engineer-harbor',
        title: 'Full Stack Engineer',
        company_name: 'Harbor Digital',
        location: 'Ottawa, ON',
        category: 'Engineering',
        salary_min: 95000,
        salary_max: 135000,
        company_description:
            'Harbor Digital partners with organizations to deliver useful digital services.',
        description:
            'Ship frontend and backend improvements and help shape a maintainable platform.',
        required_skills: ['React', 'Node.js', 'SQL'],
    },
]

const FILTER_KEYS = [
    'keyword',
    'location',
    'category',
    'salaryMin',
    'salaryMax',
]

function getSearchParams(query = '') {
    if (query instanceof URLSearchParams) {
        return query
    }

    if (typeof query === 'string') {
        return new URLSearchParams(
            query.startsWith('?') ? query.slice(1) : query,
        )
    }

    return new URLSearchParams()
}

export function readJobFilters(query = '') {
    const params = getSearchParams(query)

    return Object.fromEntries(
        FILTER_KEYS.map((key) => [key, params.get(key) || '']),
    )
}

export function createJobSearchParams(filters = {}) {
    const params = new URLSearchParams()

    for (const key of FILTER_KEYS) {
        const value = String(filters[key] ?? '').trim()

        if (value) {
            params.set(key, value)
        }
    }

    return params
}

export function validateJobFilters(filters = {}) {
    const errors = {}
    const minimum = String(filters.salaryMin ?? '').trim()
    const maximum = String(filters.salaryMax ?? '').trim()

    for (const [key, value] of [
        ['salaryMin', minimum],
        ['salaryMax', maximum],
    ]) {
        if (!value) continue

        const amount = Number(value)

        if (!Number.isFinite(amount) || amount < 0) {
            errors[key] = 'Enter a valid non-negative salary.'
        }
    }

    if (
        !errors.salaryMin &&
        !errors.salaryMax &&
        minimum &&
        maximum &&
        Number(minimum) > Number(maximum)
    ) {
        errors.salaryMax =
            'Maximum salary must be greater than or equal to minimum salary.'
    }

    return errors
}

function includesText(value, search) {
    return String(value ?? '')
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase())
}

function matchesJob(job, filters) {
    const keyword = String(filters.keyword ?? '').trim()
    const location = String(filters.location ?? '').trim()
    const category = String(filters.category ?? '').trim()
    const salaryMin = String(filters.salaryMin ?? '').trim()
    const salaryMax = String(filters.salaryMax ?? '').trim()

    if (
        keyword &&
        ![
            job.title,
            job.company_name,
            ...(job.required_skills || []),
        ].some((value) => includesText(value, keyword))
    ) {
        return false
    }

    if (location && !includesText(job.location, location)) {
        return false
    }

    if (
        category &&
        String(job.category).toLocaleLowerCase() !==
            category.toLocaleLowerCase()
    ) {
        return false
    }

    if (salaryMin && job.salary_max < Number(salaryMin)) {
        return false
    }

    if (salaryMax && job.salary_min > Number(salaryMax)) {
        return false
    }

    return true
}

export async function getJobs(filters = {}) {
    const errors = validateJobFilters(filters)

    if (Object.keys(errors).length) {
        throw new Error(Object.values(errors).join(' '))
    }

    return JOBS.filter((job) => matchesJob(job, filters))
}

export async function getJob(jobId) {
    return JOBS.find((job) => job.id === String(jobId)) || null
}

export function formatJobSalary(job) {
    const formatter = new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: 'CAD',
        maximumFractionDigits: 0,
    })
    const minimum = Number(job.salary_min)
    const maximum = Number(job.salary_max)

    if (Number.isFinite(minimum) && Number.isFinite(maximum)) {
        return `${formatter.format(minimum)}–${formatter.format(maximum)} / year`
    }

    if (Number.isFinite(minimum)) {
        return `From ${formatter.format(minimum)} / year`
    }

    if (Number.isFinite(maximum)) {
        return `Up to ${formatter.format(maximum)} / year`
    }

    return 'Salary not provided'
}