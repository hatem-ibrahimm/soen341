import EntryListSection from './EntryListSection.jsx'
import styles from './ProfilePage.module.css'

// Field names match the work_experiences table (job_title, company, dates, description).
const FIELDS = [
    { name: 'job_title', label: 'Job title', required: true, full: true },
    { name: 'company', label: 'Company', required: true },
    { name: 'dates', label: 'Dates', placeholder: 'Sep 2024 – May 2025' },
    { name: 'description', label: 'Description', full: true, multiline: true },
]

export default function ExperienceSection({ items, onSave }) {
    return (
        <EntryListSection
            id="experience"
            title="Experience"
            icon="◇"
            items={items}
            fields={FIELDS}
            onSave={onSave}
            emptyText="Add your work experience"
            addLabel="Add experience"
            renderItem={(e) => (
                <>
                    <h3 className={styles.entryTitle}>{e.job_title}</h3>
                    <p className={styles.entrySub}>{e.company}</p>
                    {e.dates && <p className={styles.entryMeta}>{e.dates}</p>}
                    {e.description && <p className={styles.entryText}>{e.description}</p>}
                </>
            )}
        />
    )
}
