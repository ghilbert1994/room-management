/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState, useContext } from "react"
import {
    Wrench,
    Monitor,
    BellRing,
    CheckCircle2,
    Info,
    MapPin,
    Send,
    ClipboardList
} from "lucide-react"
import "./Schedules.css"
import { UserContext } from "../auth/UserContext.jsx"
import { normalizeRole } from "../auth/roles.js"
import { pageTitleFor } from "../lib/pageTitles.js"

const formatUntil = (value) => {
    if (!value) return "Not set"
    const text = String(value).slice(0, 10)
    return text || "Not set"
}

const formatDate = (value) => {
    if (!value) return "N/A"
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toLocaleDateString()
}

const reportTarget = (report) =>
    report.computer_id
        ? `PC ${report.pc_number} in ${report.room_name}`
        : report.room_name

const statusStyle = (status) => {
    if (status === "open") return { bg: "#fef3c7", text: "#b45309" }
    if (status === "dismissed") return { bg: "#f1f5f9", text: "#475569" }
    return { bg: "#dcfce7", text: "#166534" }
}

function FacilityIssues() {
    const { user } = useContext(UserContext)
    const role = normalizeRole(user?.role)
    const canManage = role === "admin" || role === "mis_staff"

    const [issues, setIssues] = useState({ rooms: [], computers: [] })
    const [reports, setReports] = useState([])
    const [options, setOptions] = useState({ rooms: [], computers: [] })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [notice, setNotice] = useState(null)
    const [busy, setBusy] = useState("")

    const [form, setForm] = useState({ roomId: "", computerId: "", description: "" })

    const loadData = async () => {
        try {
            const reportsResponse = await fetch("/api/facility/reports", { credentials: "include" })
            const reportsData = await reportsResponse.json()
            if (!reportsResponse.ok) throw new Error(reportsData.error || "Failed to load reports")
            setReports(reportsData.reports || [])

            if (canManage) {
                const issuesResponse = await fetch("/api/lab/issues", { credentials: "include" })
                const issuesData = await issuesResponse.json()
                if (!issuesResponse.ok) throw new Error(issuesData.error || "Failed to load facility issues")
                setIssues({ rooms: issuesData.rooms || [], computers: issuesData.computers || [] })
            } else {
                const optionsResponse = await fetch("/api/facility/report-options", { credentials: "include" })
                const optionsData = await optionsResponse.json()
                if (!optionsResponse.ok) throw new Error(optionsData.error || "Failed to load laboratories")
                setOptions({ rooms: optionsData.rooms || [], computers: optionsData.computers || [] })
            }
        } catch (error) {
            setNotice({ type: "error", text: error.message })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [canManage])

    const handleChange = (event) => {
        const { name, value } = event.target
        setForm((previous) => {
            const next = { ...previous, [name]: value }
            if (name === "roomId") next.computerId = ""
            return next
        })
    }

    const submitReport = async (event) => {
        event.preventDefault()
        setNotice(null)

        if (!form.roomId && !form.computerId) {
            setNotice({ type: "error", text: "Choose a room or a computer to report." })
            return
        }
        if (form.description.trim().length < 3) {
            setNotice({ type: "error", text: "Describe the problem in at least 3 characters." })
            return
        }

        setSaving(true)
        try {
            const response = await fetch("/api/facility/reports", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    roomId: form.roomId || null,
                    computerId: form.computerId || null,
                    description: form.description.trim()
                })
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || "Failed to submit report")

            setNotice({ type: "success", text: "Report submitted. MIS staff will review it." })
            setForm({ roomId: "", computerId: "", description: "" })
            await loadData()
        } catch (error) {
            setNotice({ type: "error", text: error.message })
        } finally {
            setSaving(false)
        }
    }

    const runAction = async (key, { url, method = "PUT", body, success }) => {
        setBusy(key)
        setNotice(null)
        try {
            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(body || {})
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || "Action failed")

            setNotice({ type: "success", text: success })
            await loadData()
        } catch (error) {
            setNotice({ type: "error", text: error.message })
        } finally {
            setBusy("")
        }
    }

    const endRoomMaintenance = (room) => runAction(`room-${room.id}`, {
        url: "/api/lab/maintenance",
        body: { roomName: room.name, maintenance: false },
        success: `${room.name} is available again.`
    })

    const markComputerFixed = (computer) => runAction(`pc-${computer.id}`, {
        url: "/api/lab/toggle-pc",
        body: { computerId: computer.id, isMaintenance: false },
        success: `PC ${computer.pc_number} in ${computer.room_name} is back in service.`
    })

    const sendReminder = (type, id, label) => runAction(`notify-${type}-${id}`, {
        url: "/api/lab/issues/notify",
        method: "POST",
        body: { type, id },
        success: `Reminder sent for ${label}.`
    })

    const resolveReport = (report, action) => runAction(`report-${report.id}-${action}`, {
        url: `/api/facility/reports/${report.id}/resolve`,
        body: { action },
        success: action === "dismiss"
            ? "Report dismissed."
            : `Report closed for ${reportTarget(report)}.`
    })

    const openReports = reports.filter((report) => report.status === "open")
    const myOpenReports = reports.filter((report) => report.status === "open").length
    const roomComputers = options.computers.filter(
        (computer) => String(computer.room_id) === String(form.roomId)
    )

    return (
        <div className="schedule-page">
            <div className="schedule-hero">
                <div>
                    <h1>{pageTitleFor("facilityIssues", role)}</h1>
                    <p>
                        {canManage
                            ? "Review equipment reports, and manage rooms under maintenance and computers out of service. Student-facing notifications are sent automatically."
                            : "Report a broken computer, laboratory room, or equipment problem. MIS staff review and resolve every report."}
                    </p>
                </div>
                <div className="hero-meta">
                    {canManage ? (
                        <>
                            <span className="hero-chip"><Wrench size={14} /> {issues.rooms.length} room{issues.rooms.length === 1 ? "" : "s"}</span>
                            <span className="hero-chip"><Monitor size={14} /> {issues.computers.length} PC{issues.computers.length === 1 ? "" : "s"}</span>
                            <span className="hero-chip"><ClipboardList size={14} /> {openReports.length} report{openReports.length === 1 ? "" : "s"}</span>
                        </>
                    ) : (
                        <span className="hero-chip"><ClipboardList size={14} /> {myOpenReports} open report{myOpenReports === 1 ? "" : "s"}</span>
                    )}
                </div>
            </div>

            {notice && (
                <div className={notice.type === "error" ? "schedule-error" : "schedule-notice"}>
                    {notice.text}
                </div>
            )}

            {!canManage && (
                <div className="schedule-card">
                    <div className="schedule-card-header">
                        <div>
                            <h2>Report an Issue</h2>
                            <p>Choose a room, or a specific PC, and describe the problem.</p>
                        </div>
                    </div>
                    <div style={{ padding: 20 }}>
                        <form className="schedule-form" onSubmit={submitReport}>
                            <div className="form-grid">
                                <div className="form-field">
                                    <label>Laboratory</label>
                                    <select name="roomId" value={form.roomId} onChange={handleChange}>
                                        <option value="">Select laboratory</option>
                                        {options.rooms.map((room) => (
                                            <option key={room.id} value={room.id}>
                                                {room.name}{room.location ? ` — ${room.location}` : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-field">
                                    <label>Computer (optional)</label>
                                    <select
                                        name="computerId"
                                        value={form.computerId}
                                        onChange={handleChange}
                                        disabled={!form.roomId || roomComputers.length === 0}
                                    >
                                        <option value="">Room / equipment in general</option>
                                        {roomComputers.map((computer) => (
                                            <option key={computer.id} value={computer.id}>
                                                PC {computer.pc_number}{computer.is_maintenance ? " (already flagged)" : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                                    <label>Problem Description</label>
                                    <textarea
                                        name="description"
                                        value={form.description}
                                        onChange={handleChange}
                                        rows={3}
                                        maxLength={500}
                                        placeholder="e.g. Monitor does not turn on, keyboard missing keys..."
                                        required
                                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
                                    />
                                </div>
                            </div>

                            <div className="form-actions">
                                <button type="submit" className="primary-btn" disabled={saving}>
                                    <Send size={16} /> {saving ? "Submitting..." : "Submit Report"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {canManage && (
                <div className="schedule-card">
                    <div className="schedule-card-header">
                        <div>
                            <h2>Reported Issues</h2>
                            <p>Reports submitted by faculty. Flag the room or PC, or dismiss the report.</p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="schedule-empty"><p>Loading reports...</p></div>
                    ) : openReports.length === 0 ? (
                        <div className="schedule-empty">
                            <CheckCircle2 size={32} color="#16a34a" />
                            <h3>No open reports</h3>
                            <p>Everything reported so far has been handled.</p>
                        </div>
                    ) : (
                        <div className="schedule-table-wrapper">
                            <table className="schedule-table">
                                <thead>
                                    <tr>
                                        <th>Target</th>
                                        <th>Reported By</th>
                                        <th>Problem</th>
                                        <th>Submitted</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {openReports.map((report) => (
                                        <tr key={report.id}>
                                            <td style={{ fontWeight: 700, color: "var(--navy-900)" }}>
                                                {reportTarget(report)}
                                            </td>
                                            <td>{report.reporter_name || report.reporter_email}</td>
                                            <td>{report.description}</td>
                                            <td>{formatDate(report.created_at)}</td>
                                            <td>
                                                <div className="row-actions">
                                                    <button
                                                        type="button"
                                                        className="primary-btn"
                                                        disabled={busy === `report-${report.id}-apply`}
                                                        onClick={() => resolveReport(report, "apply")}
                                                    >
                                                        <Wrench size={14} /> {report.computer_id ? "Flag PC" : "Set maintenance"}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="ghost-btn"
                                                        disabled={busy === `report-${report.id}-clear`}
                                                        onClick={() => resolveReport(report, "clear")}
                                                    >
                                                        <CheckCircle2 size={14} /> Mark fixed
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="ghost-btn"
                                                        disabled={busy === `report-${report.id}-dismiss`}
                                                        onClick={() => resolveReport(report, "dismiss")}
                                                    >
                                                        Dismiss
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {canManage && (
                <>
                    <div className="schedule-card">
                        <div className="schedule-card-header">
                            <div>
                                <h2>Rooms Under Maintenance</h2>
                                <p>Students cannot reserve these rooms until maintenance ends.</p>
                            </div>
                        </div>

                        {loading ? (
                            <div className="schedule-empty"><p>Loading facility issues...</p></div>
                        ) : issues.rooms.length === 0 ? (
                            <div className="schedule-empty">
                                <CheckCircle2 size={32} color="#16a34a" />
                                <h3>No rooms under maintenance</h3>
                                <p>Every laboratory is currently bookable.</p>
                            </div>
                        ) : (
                            <div className="schedule-table-wrapper">
                                <table className="schedule-table">
                                    <thead>
                                        <tr>
                                            <th>Laboratory</th>
                                            <th>Location</th>
                                            <th>Reason</th>
                                            <th>Expected Back</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {issues.rooms.map((room) => (
                                            <tr key={room.id}>
                                                <td style={{ fontWeight: 700, color: "var(--navy-900)" }}>{room.name}</td>
                                                <td>
                                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                                        <MapPin size={13} color="#94a3b8" /> {room.location || "N/A"}
                                                    </span>
                                                </td>
                                                <td>{room.maintenance_reason || "No reason provided"}</td>
                                                <td>{formatUntil(room.maintenance_until)}</td>
                                                <td>
                                                    <div className="row-actions">
                                                        <button
                                                            type="button"
                                                            className="ghost-btn"
                                                            disabled={busy === `notify-room-${room.id}`}
                                                            onClick={() => sendReminder("room", room.id, room.name)}
                                                        >
                                                            <BellRing size={14} /> Notify students
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="primary-btn"
                                                            disabled={busy === `room-${room.id}`}
                                                            onClick={() => endRoomMaintenance(room)}
                                                        >
                                                            <CheckCircle2 size={14} /> Mark available
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="schedule-card">
                        <div className="schedule-card-header">
                            <div>
                                <h2>Computers Out of Service</h2>
                                <p>Reported units stay listed until they are marked fixed.</p>
                            </div>
                        </div>

                        {loading ? (
                            <div className="schedule-empty"><p>Loading facility issues...</p></div>
                        ) : issues.computers.length === 0 ? (
                            <div className="schedule-empty">
                                <CheckCircle2 size={32} color="#16a34a" />
                                <h3>No computers reported</h3>
                                <p>All laboratory units are working.</p>
                            </div>
                        ) : (
                            <div className="schedule-table-wrapper">
                                <table className="schedule-table">
                                    <thead>
                                        <tr>
                                            <th>Laboratory</th>
                                            <th>Unit</th>
                                            <th>Reason</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {issues.computers.map((computer) => (
                                            <tr key={computer.id}>
                                                <td style={{ fontWeight: 700, color: "var(--navy-900)" }}>{computer.room_name}</td>
                                                <td>PC {computer.pc_number}</td>
                                                <td>{computer.maintenance_reason || "No reason provided"}</td>
                                                <td>
                                                    <div className="row-actions">
                                                        <button
                                                            type="button"
                                                            className="ghost-btn"
                                                            disabled={busy === `notify-computer-${computer.id}`}
                                                            onClick={() => sendReminder("computer", computer.id, `PC ${computer.pc_number}`)}
                                                        >
                                                            <BellRing size={14} /> Notify students
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="primary-btn"
                                                            disabled={busy === `pc-${computer.id}`}
                                                            onClick={() => markComputerFixed(computer)}
                                                        >
                                                            <CheckCircle2 size={14} /> Mark fixed
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            <div className="schedule-card">
                <div className="schedule-card-header">
                    <div>
                        <h2>
                            {canManage ? "How Students Are Notified" : "My Reports"}
                        </h2>
                        <p>
                            {canManage
                                ? "No manual step needed once an issue is recorded."
                                : "Track what you submitted and how it was resolved."}
                        </p>
                    </div>
                </div>

                {!canManage ? (
                    loading ? (
                        <div className="schedule-empty"><p>Loading your reports...</p></div>
                    ) : reports.length === 0 ? (
                        <div className="schedule-empty">
                            <ClipboardList size={32} color="#94a3b8" />
                            <h3>No reports yet</h3>
                            <p>Submit a report above when something in a laboratory is not working.</p>
                        </div>
                    ) : (
                        <div className="schedule-table-wrapper">
                            <table className="schedule-table">
                                <thead>
                                    <tr>
                                        <th>Target</th>
                                        <th>Problem</th>
                                        <th>Status</th>
                                        <th>Submitted</th>
                                        <th>Resolution</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reports.map((report) => {
                                        const colors = statusStyle(report.status)
                                        return (
                                            <tr key={report.id}>
                                                <td style={{ fontWeight: 700, color: "var(--navy-900)" }}>
                                                    {reportTarget(report)}
                                                </td>
                                                <td>{report.description}</td>
                                                <td>
                                                    <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, backgroundColor: colors.bg, color: colors.text, textTransform: "capitalize" }}>
                                                        {report.status}
                                                    </span>
                                                </td>
                                                <td>{formatDate(report.created_at)}</td>
                                                <td>{report.resolution_note || (report.status === "open" ? "Waiting for review" : "—")}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : (
                    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12, fontSize: 13.5, color: "var(--text-soft)", lineHeight: 1.55 }}>
                        <p style={{ margin: 0, display: "flex", gap: 8 }}>
                            <Info size={16} style={{ flexShrink: 0, marginTop: 2, color: "var(--navy-700)" }} />
                            Flagging a room or PC sends a notification to every active student account.
                        </p>
                        <p style={{ margin: 0, display: "flex", gap: 8 }}>
                            <BellRing size={16} style={{ flexShrink: 0, marginTop: 2, color: "var(--navy-700)" }} />
                            Students see it in the notification bell, which refreshes every 30 seconds.
                        </p>
                        <p style={{ margin: 0, display: "flex", gap: 8 }}>
                            <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 2, color: "var(--navy-700)" }} />
                            Marking a room available or a PC fixed sends a follow-up "back in service" notice.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}

export default FacilityIssues
