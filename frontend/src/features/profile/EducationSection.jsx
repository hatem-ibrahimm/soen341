import EntryListSection from './EntryListSection.jsx'
import styles from './ProfilePage.module.css'

// Field names match the education table (school, degree, years).
const FIELDS = [
    { name: 'school', label: 'School', required: true, full: true },
    { name: 'degree', label: 'Degree' },
    { name: 'years', label: 'Years', placeholder: '2023 – 2027' },
]

export default function EducationSection({ items, onSave }) {
    return (
        <EntryListSection
            id="education"
            title="Education"
            icon="◇"
            items={items}
            fields={FIELDS}
            onSave={onSave}
            emptyText="Add your education"
            addLabel="Add education"
            renderItem={(e) => (
                <>
                    <h3 className={styles.entryTitle}>{e.school}</h3>
                    {e.degree && <p className={styles.entrySub}>{e.degree}</p>}
                    {e.years && <p className={styles.entryMeta}>{e.years}</p>}
                </>
            )}
        />
    )
}
