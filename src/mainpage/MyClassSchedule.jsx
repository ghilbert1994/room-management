/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react"
import { BookOpen, CalendarDays, Clock, MapPin, User } from "lucide-react"
import "./Schedules.css"
import { CalendarSkeleton } from "../layout/Loading.jsx"
import WeeklyClassCalendar from "../layout/WeeklyClassCalendar.jsx"
import { PAGE_TITLES } from "../lib/pageTitles.js"

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

const shortTime = (value) => String(value || "").slice(0, 5)

function MyClassSchedule() {
    const [schedules, setSchedules] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [semesterId, setSemesterId] = useState("all")

    const loadSchedule = async () => {
        try {
            const response = await fetch("/api/schedule/my-schedules", { credentials: "include" })
            const data = await response.json()
            if (!response.ok) throw new Error(data.message || "Failed to load your class schedule")
            setSchedules(data.schedules || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadSchedule()
    }, [])

    const semesters = useMemo(() => {
        const map = new Map()
        for (const item of schedules) {
            if (!map.has(String(item.semester_id))) {
                map.set(String(item.semester_id), {
                    id: String(item.semester_id),
                    label: `${item.school_year} · ${item.term}`,
                    isActive: item.is_active
                })
            }
        }
        return [...map.values()]
    }, [schedules])

    const visibleSchedules = useMemo(
        () => schedules.filter((item) => semesterId === "all" || String(item.semester_id) === semesterId),
        [schedules, semesterId]
    )

    return (
        <div className="schedule-page">
            <div className="schedule-hero">
                <div>
                    <h1>{PAGE_TITLES.myClassSchedule}</h1>
                    <p>
                        Your published teaching schedule for the semester: subjects, sections,
                        rooms, and meeting times.
                    </p>
                </div>
                <div className="hero-meta">
                    <span className="hero-chip"><BookOpen size={14} /> {visibleSchedules.length} class{visibleSchedules.length === 1 ? "" : "es"}</span>
                    {semesters.length > 1 && (
                        <select
                            value={semesterId}
                            onChange={(event) => setSemesterId(event.target.value)}
                            style={{ height: 34, borderRadius: 8, border: "1px solid rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.12)", color: "#fff", padding: "0 10px", fontWeight: 600 }}
                        >
                            <option value="all" style={{ color: "#0f172a" }}>All semesters</option>
                            {semesters.map((semester) => (
                                <option key={semester.id} value={semester.id} style={{ color: "#0f172a" }}>
                                    {semester.label}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {error && <div className="schedule-error">{error}</div>}

            <div className="schedule-card">
                <div className="schedule-card-header">
                    <div>
                        <h2>Weekly Timetable</h2>
                        <p>Classes appear on the day and time they meet.</p>
                    </div>
                </div>
                <div style={{ padding: 16 }}>
                    {loading ? (
                        <CalendarSkeleton label="Loading your class schedule" />
                    ) : visibleSchedules.length === 0 ? (
                        <div className="schedule-empty">
                            <CalendarDays size={32} color="#94a3b8" />
                            <h3>No classes scheduled</h3>
                            <p>The admin has not published any class for your account in this semester yet.</p>
                        </div>
                    ) : (
                        <WeeklyClassCalendar schedules={visibleSchedules} />
                    )}
                </div>
            </div>

            <div className="schedule-card">
                <div className="schedule-card-header">
                    <div>
                        <h2>Class List</h2>
                        <p>Every class assigned to you, in timetable order.</p>
                    </div>
                </div>

                {visibleSchedules.length === 0 ? (
                    <div className="schedule-empty">
                        <p>Nothing to show yet.</p>
                    </div>
                ) : (
                    <div className="schedule-table-wrapper">
                        <table className="schedule-table">
                            <thead>
                                <tr>
                                    <th>Subject</th>
                                    <th>Course &amp; Section</th>
                                    <th>Day</th>
                                    <th>Time</th>
                                    <th>Room</th>
                                    <th>Instructor</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...visibleSchedules]
                                    .sort((a, b) => (a.day_of_week - b.day_of_week) || String(a.start_time).localeCompare(String(b.start_time)))
                                    .map((item) => (
                                        <tr key={item.id}>
                                            <td>
                                                <strong style={{ color: "var(--navy-900)" }}>{item.subject}</strong>
                                                <div className="muted" style={{ color: "var(--text-muted)", fontSize: 12 }}>{item.subject_code || "—"}</div>
                                            </td>
                                            <td>
                                                {item.course} {item.year_level}
                                                <div className="muted" style={{ color: "var(--text-muted)", fontSize: 12 }}>Section {item.section}</div>
                                            </td>
                                            <td>{DAY_NAMES[item.day_of_week] || "—"}</td>
                                            <td>
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                                    <Clock size={13} color="#94a3b8" /> {shortTime(item.start_time)}–{shortTime(item.end_time)}
                                                </span>
                                            </td>
                                            <td>
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                                    <MapPin size={13} color="#94a3b8" /> {item.room_name || item.room || "TBA"}
                                                </span>
                                                <div className="muted" style={{ color: "var(--text-muted)", fontSize: 12, textTransform: "capitalize" }}>
                                                    {item.room_type || "laboratory"}
                                                </div>
                                            </td>
                                            <td>
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                                    <User size={13} color="#94a3b8" /> {item.instructor || "TBA"}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}

export default MyClassSchedule
