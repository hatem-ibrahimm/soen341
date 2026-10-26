// Application statuses from the Sprint 2 spec, in pipeline order.
// Keep these values identical to what the backend stores.
export const APPLICATION_STATUSES = [
    'Applied',
    'Under Review',
    'Interview',
    'Offered',
    'Rejected',
]

// The "happy path" shown in the progress tracker. Rejected can happen at any step.
export const PIPELINE_STEPS = ['Applied', 'Under Review', 'Interview', 'Offered']

export const STATUS_TONE = {
    Applied: 'blue',
    'Under Review': 'amber',
    Interview: 'purple',
    Offered: 'green',
    Rejected: 'red',
}
