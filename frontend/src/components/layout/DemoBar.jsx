import { USE_MOCK_API } from '../../services/apiClient.js'
import { resetDb } from '../../services/mockStore.js'
import styles from './AppLayout.module.css'

// Only visible in mock mode: reminds you the data is fake and lets you reset it.
export default function DemoBar() {
    if (!USE_MOCK_API) return null
    return (
        <div className={styles.demoBar}>
            Demo mode · sample data saved in this browser only
            <button
                onClick={() => {
                    resetDb()
                    window.location.reload()
                }}
            >
                Reset demo data
            </button>
        </div>
    )
}
