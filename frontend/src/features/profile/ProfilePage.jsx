import { useState } from 'react'
import { Alert } from '../../components/common'
import AboutSection from './AboutSection.jsx'
import EditIntroModal from './EditIntroModal.jsx'
import EducationSection from './EducationSection.jsx'
import ExperienceSection from './ExperienceSection.jsx'
import ProfileHeader from './ProfileHeader.jsx'
import ProfileSidebar from './ProfileSidebar.jsx'
import ResumeSection from './ResumeSection.jsx'
import SkillsSection from './SkillsSection.jsx'
import useProfile from './useProfile.js'
import styles from './ProfilePage.module.css'

// One scrolling profile page. Each section has its own Edit button and pop-up form
// instead of tabs, so the whole profile is visible at once.
export default function ProfilePage() {
    const p = useProfile()
    const [editingIntro, setEditingIntro] = useState(false)

    if (p.loading) return <p className={styles.placeholder}>Loading your profile…</p>
    if (p.error || !p.profile) return <Alert tone="error">{p.error || 'Could not load your profile.'}</Alert>

    return (
        <div className={styles.page}>
            <ProfileHeader
                profile={p.profile}
                onEdit={() => setEditingIntro(true)}
                onAvatarChange={p.saveAvatar}
                onCoverChange={p.saveCover}
                onCoverRemove={p.removeCover}
            />

            <div className={styles.layout}>
                <div className={styles.mainCol}>
                    <AboutSection bio={p.profile.bio} onSave={p.savePersonal} />
                    <ExperienceSection items={p.experiences} onSave={p.saveExperiences} />
                    <EducationSection items={p.education} onSave={p.saveEducation} />
                    <SkillsSection skills={p.skills} onSave={p.saveSkills} />
                    <ResumeSection />
                </div>
                <ProfileSidebar />
            </div>

            {editingIntro && (
                <EditIntroModal profile={p.profile} onSave={p.savePersonal} onClose={() => setEditingIntro(false)} />
            )}
        </div>
    )
}
