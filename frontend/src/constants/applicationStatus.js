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

// Colours for charts (analytics dashboard). Same hue families as the badges
// above, but one step brighter so thin bars stay readable. Checked with a
// colour-blind simulator: every neighbouring pair stays distinguishable.
export const STATUS_CHART_COLOR = {
    Applied: '#3b6fd1',
    'Under Review': '#b07d12',
    Interview: '#8256cc',
    Offered: '#23936a',
    Rejected: '#d6452f',
}
