import { Link } from 'react-router-dom'
import { formatJobSalary } from '../services/jobApi.js'

function JobCard({ job, search = '' }) {
    const detailsTo = {
        pathname: `/jobs/${encodeURIComponent(job.id)}`,
        search,
    }

    return (
        <article className="job-card">
            <h3>
                <Link to={detailsTo}>
                    {job.title}
                </Link>
            </h3>

            <p><strong>{job.company_name}</strong></p>

            <dl className="job-card-summary">
                <div>
                    <dt>Location</dt>
                    <dd>{job.location}</dd>
                </div>
                <div>
                    <dt>Category</dt>
                    <dd>{job.category}</dd>
                </div>
                <div>
                    <dt>Salary</dt>
                    <dd>{formatJobSalary(job)}</dd>
                </div>
            </dl>

            <h4>Required skills</h4>

            {job.required_skills?.length ? (
                <ul className="job-card-skills">
                    {job.required_skills.map((skill) => (
                        <li key={skill}>{skill}</li>
                    ))}
                </ul>
            ) : (
                <p>Required skills not provided.</p>
            )}

            <div className="job-card-actions">
                <Link to={detailsTo}>View job details</Link>
                <Link
                    to={`/jobs/${encodeURIComponent(job.id)}/apply`}
                    className="job-apply-link"
                >
                    Apply
                </Link>
            </div>
        </article>
    )
}

export default JobCard