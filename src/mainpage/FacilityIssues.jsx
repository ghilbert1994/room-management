/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react"
import { Wrench, Monitor, BellRing, CheckCircle2, Info, MapPin } from "lucide-react"
import "./Schedules.css"
import { PAGE_TITLES } from "../lib/pageTitles.js"

const API = "/api/lab"

const formatUntil = (value) => {
    if (!value) return "Not set"
    const text = String(value).slice(0, 10)
    return text || "Not set"
}

function FacilityIssues() {
    const [issues, setIssues] = useState({ rooms: [], computers: [] })
    const [loading, setLoading] = useState(true)
    const [notice, setNotice] = useState(null)
    const [busy, setBusy] = useState("")

    const loadIssues = async () => {
        try {
            const response = await fetch(`${API}/issues`, { credentials: "include" })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || "Failed to load facility issues")
            setIssues({ rooms: data.rooms || [], computers: data.computers || [] })
        } catch (error) {
            setNotice({ type: "error", text: error.message })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadIssues()
    }, [])

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

            const notified = Number(data.notified || 0)
            setNotice({
                type: "success",
                text: `${success}${notified > 0 ? ` ${notified} student${notified === 1 ? "" : "s"} notified.` : ""}`
            })
            await loadIssues()
        } catch (error) {
            setNotice({ type: "error", text: error.message })
        } finally {
            setBusy("")
        }
    }

    const endRoomMaintenance = (room) => runAction(`room-${room.id}`, {
        url: `${API}/maintenance`,
        body: { roomName: room.name, maintenance: false },
        success: `${room.name} is available again.`
    })

    const markComputerFixed = (computer) => runAction(`pc-${computer.id}`, {
        url: `${API}/toggle-pc`,
        body: { computerId: computer.id, isMaintenance: false },
        success: `PC ${computer.pc_number} in ${computer.room_name} is back in service.`
    })

    const sendReminder = (type, id, label) => runAction(`notify-${type}-${id}`, {
        url: `${API}/issues/notify`,
        method: "POST",
        body: { type, id },
        success: `Reminder sent for ${label}.`
    })

    const totalIssues = issues.rooms.length + issues.computers.length

    return (
        <div className="schedule-page">
            <div className="schedule-hero">
                <div>
                    <h1>{PAGE_TITLES.facilityIssues}</h1>
                    <p>
                        Rooms under maintenance and computers reported out of service. Every
                        change here notifies all active student accounts.
                    </p>
                </div>
                <div className="hero-meta">
                    <span className="hero-chip"><Wrench size={14} /> {issues.rooms.length} room{issues.rooms.length === 1 ? "" : "s"}</span>
                    <span className="hero-chip"><Monitor size={14} /> {issues.computers.length} PC{issues.computers.length === 1 ? "" : "s"}</span>
                    <span className="hero-chip"><BellRing size={14} /> {totalIssues} open</span>
                </div>
            </div>

            {notice && (
                <div className={notice.type === "error" ? "schedule-error" : "schedule-notice"}>
                    {notice.text}
                </div>
            )}

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

            <div className="schedule-card">
                <div className="schedule-card-header">
                    <div>
                        <h2>How Students Are Notified</h2>
                        <p>No manual step needed once an issue is recorded.</p>
                    </div>
                </div>
                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12, fontSize: 13.5, color: "var(--text-soft)", lineHeight: 1.55 }}>
                    <p style={{ margin: 0, display: "flex", gap: 8 }}>
                        <Info size={16} style={{ flexShrink: 0, marginTop: 2, color: "var(--navy-700)" }} />
                        Putting a room under maintenance or reporting a PC sends a notification to every active student account.
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
            </div>
        </div>
    )
}

export default FacilityIssues
