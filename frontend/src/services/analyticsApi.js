import { request, USE_MOCK_API } from './apiClient.js'
import { listMyApplications } from './applicationApi.js'
import { APPLICATION_STATUSES } from '../constants/applicationStatus.js'

// Application analytics for the dashboard (Sprint 3).
// Backend routes used:
//   GET /api/analytics/applications
//       -> { total_applications, by_status: { Applied, "Under Review", Interview, Offered, Rejected } }
//   GET /api/applications?limit=100   (through listMyApplications)
//       -> every application with its submitted date, used for the history list
//          and the "applications per week" chart.
//
// The backend counts come from the database, so we trust them for the status
// breakdown. If that call fails we count the list ourselves instead, so the
// page still works.

function countByStatus(applications) {
    const byStatus = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0]))
    for (const app of applications) {
        if (app.status in byStatus) byStatus[app.status] += 1
    }
    return byStatus
}

export async function getApplicationAnalytics() {
    if (USE_MOCK_API) {
        const applications = await listMyApplications()
        return {
            total: applications.length,
            byStatus: countByStatus(applications),
            applications,
        }
    }

    const [summary, applications] = await Promise.all([
        request('/api/analytics/applications').catch(() => null),
        listMyApplications(),
    ])

    if (!summary) {
        return { total: applications.length, byStatus: countByStatus(applications), applications }
    }
    return {
        total: summary.total_applications ?? applications.length,
        byStatus: { ...countByStatus([]), ...summary.by_status },
        applications,
    }
}
