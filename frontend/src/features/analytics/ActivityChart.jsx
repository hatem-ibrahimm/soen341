import { useEffect, useMemo, useRef, useState } from 'react'
import { plural, weeklyCounts } from './analyticsMath.js'
import styles from './Analytics.module.css'

const RANGES = [
    { weeks: 8, label: '8 weeks' },
    { weeks: 12, label: '12 weeks' },
    { weeks: 26, label: '6 months' },
]

const HEIGHT = 200
const PAD = { top: 22, right: 8, bottom: 26, left: 28 }

const shortDate = (d) => d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })

// Rounded top, square bottom: the bar "grows" out of the baseline.
function barPath(x, y, w, h) {
    const r = Math.min(4, w / 2, h)
    return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`
}

// Watches the element's width so the SVG is drawn at its real size
// (text stays crisp instead of being stretched).
function useWidth() {
    const ref = useRef(null)
    const [width, setWidth] = useState(640)
    useEffect(() => {
        if (!ref.current) return undefined
        const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
        observer.observe(ref.current)
        return () => observer.disconnect()
    }, [])
    return [ref, width]
}

export default function ActivityChart({ applications }) {
    const [weeks, setWeeks] = useState(12)
    const [hover, setHover] = useState(null)
    const [wrapRef, width] = useWidth()

    const data = useMemo(() => weeklyCounts(applications, weeks), [applications, weeks])
    const max = Math.max(...data.map((d) => d.count))
    const inRange = data.reduce((sum, d) => sum + d.count, 0)

    // y axis: clean whole-number ticks
    const top = Math.max(2, max <= 4 ? max : Math.ceil(max / 2) * 2)
    const step = top <= 4 ? 1 : top / 2
    const ticks = []
    for (let t = 0; t <= top; t += step) ticks.push(t)

    const plotW = Math.max(100, width - PAD.left - PAD.right)
    const plotH = HEIGHT - PAD.top - PAD.bottom
    const band = plotW / data.length
    const barW = Math.min(24, band * 0.62)
    const y = (v) => PAD.top + plotH - (v / top) * plotH
    const labelEvery = band < 34 ? Math.ceil(34 / band) : 1
    const busiest = max > 0 ? data.findLastIndex((d) => d.count === max) : -1
    const last = data.length - 1

    return (
        <section className={styles.panel} aria-labelledby="activity-title">
            <header className={styles.panelHead}>
                <div>
                    <h2 id="activity-title">Applications sent per week</h2>
                    <p className={styles.panelNote}>
                        {plural(inRange, 'application')} in the last {RANGES.find((r) => r.weeks === weeks).label}
                    </p>
                </div>
                <div className={styles.rangeSwitch} role="group" aria-label="Time range">
                    {RANGES.map((r) => (
                        <button
                            type="button"
                            key={r.weeks}
                            aria-pressed={weeks === r.weeks}
                            className={weeks === r.weeks ? styles.rangeOn : ''}
                            onClick={() => {
                                setWeeks(r.weeks)
                                setHover(null)
                            }}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
            </header>

            <div className={styles.chartWrap} ref={wrapRef} onMouseLeave={() => setHover(null)}>
                <svg
                    width={width}
                    height={HEIGHT}
                    role="img"
                    aria-label={`Column chart of applications per week. ${data
                        .map((d) => `Week of ${shortDate(d.start)}: ${d.count}`)
                        .join('. ')}`}
                >
                    {ticks.map((t) => (
                        <g key={t}>
                            <line
                                x1={PAD.left}
                                x2={PAD.left + plotW}
                                y1={y(t)}
                                y2={y(t)}
                                className={t === 0 ? styles.axisLine : styles.gridLine}
                            />
                            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className={styles.tick}>
                                {t}
                            </text>
                        </g>
                    ))}

                    {data.map((d, i) => {
                        const cx = PAD.left + band * i + band / 2
                        const h = (d.count / top) * plotH
                        const isHover = hover === i
                        return (
                            <g key={d.start.toISOString()}>
                                {d.count > 0 && (
                                    <path
                                        d={barPath(cx - barW / 2, y(d.count), barW, h)}
                                        className={`${styles.bar} ${i === last ? styles.barNow : ''} ${
                                            hover !== null && !isHover ? styles.barDim : ''
                                        }`}
                                    />
                                )}
                                {/* value on the cap: only the busiest week and this week */}
                                {(i === busiest || (i === last && d.count > 0)) && (
                                    <text x={cx} y={y(d.count) - 7} textAnchor="middle" className={styles.capLabel}>
                                        {d.count}
                                    </text>
                                )}
                                {(i % labelEvery === (last % labelEvery) || i === last) && (
                                    <text x={cx} y={HEIGHT - 6} textAnchor="middle" className={styles.tick}>
                                        {i === last ? 'This wk' : shortDate(d.start)}
                                    </text>
                                )}
                                {/* invisible hover target, wider than the bar */}
                                <rect
                                    x={PAD.left + band * i}
                                    y={PAD.top}
                                    width={band}
                                    height={plotH}
                                    fill="transparent"
                                    onMouseEnter={() => setHover(i)}
                                />
                            </g>
                        )
                    })}
                </svg>

                {hover !== null && (
                    <div
                        className={styles.tooltip}
                        style={{
                            left: Math.min(
                                Math.max(PAD.left + band * hover + band / 2, 90),
                                width - 90,
                            ),
                            top: Math.max(0, y(data[hover].count) - 12),
                        }}
                    >
                        <strong>
                            {shortDate(data[hover].start)} – {shortDate(new Date(data[hover].start.getTime() + 6 * 86400000))}
                        </strong>
                        <span>{plural(data[hover].count, 'application')}</span>
                        {data[hover].apps.slice(0, 3).map((a) => (
                            <span key={a.id} className={styles.tooltipJob}>
                                {a.job?.company ?? 'Unknown company'}
                            </span>
                        ))}
                        {data[hover].apps.length > 3 && (
                            <span className={styles.tooltipJob}>+{data[hover].apps.length - 3} more</span>
                        )}
                    </div>
                )}
            </div>

        </section>
    )
}
