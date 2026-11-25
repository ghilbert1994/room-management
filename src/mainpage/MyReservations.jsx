/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { BellRing, CalendarClock, ClipboardList, Search, X, Send } from "lucide-react"
import Modal from "../layout/Modal.jsx"
import { PageSkeleton } from "../layout/Loading.jsx"
import { notifyBookingsChanged } from "../lib/dataEvents.js"
import { PAGE_TITLES } from "../lib/pageTitles.js"
import "./Schedules.css"

const parseLocal = (value) => {
    if (!value) return new Date()
    const str = String(value).trim()
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/)
    if (match) {
        const [, y, mo, d, h, mi, s] = match
        return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s || 0), 0)
    }
    return new Date(str)
}

const FILTERS = ["all", "pending", "approved", "rejected", "cancelled"]

const statusStyle = (status) => {
    if (status === "approved") return { bg: "#dcfce7", text: "#166534" }
    if (status === "pending") return { bg: "#fef3c7", text: "#b45309" }
    if (status === "rejected") return { bg: "#fef2f2", text: "#b91c1c" }
    return { bg: "#f1f5f9", text: "#475569" }
}

function MyReservations() {
    const [reservations, setReservations] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState("all")
    const [search, setSearch] = useState("")
    const [notice, setNotice] = useState(null)
    const [canceling, setCanceling] = useState("")
    const [followUp, setFollowUp] = useState(null)
    const [message, setMessage] = useState("")
    const [sending, setSending] = useState(false)

    const loadReservations = async () => {
        try {
            const response = await fetch("/api/reservation/mine", { credentials: "include" })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || "Failed to load your reservations")
            setReservations(data.reservations || [])
        } catch (error) {
            setNotice({ type: "error", text: error.message })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadReservations()
    }, [])

    const counts = useMemo(() => ({
        pending: reservations.filter((item) => item.status === "pending").length,
        approved: reservations.filter((item) => item.status === "approved").length
    }), [reservations])

    const visible = useMemo(() => {
        const needle = search.trim().toLowerCase()
        return reservations
            .filter((item) => filter === "all" || item.status === filter)
            .filter((item) => !needle || [item.room, item.purpose, item.purpose_notes]
                .some((value) => String(value || "").toLowerCase().includes(needle)))
            .sort((a, b) => parseLocal(b.start) - parseLocal(a.start))
    }, [reservations, filter, search])

    const cancelReservation = async (reservation) => {
        if (!window.confirm(`Cancel your reservation for ${reservation.room}?`)) return

        setCanceling(String(reservation.id))
        setNotice(null)
        try {
            const response = await fetch("/api/reservation/delete", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ id: reservation.id })
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || "Failed to cancel reservation")
            setNotice({ type: "success", text: "Reservation cancelled." })
            notifyBookingsChanged()
            await loadReservations()
        } catch (error) {
            setNotice({ type: "error", text: error.message })
        } finally {
            setCanceling("")
        }
    }

    const sendFollowUp = async (event) => {
        event.preventDefault()
        if (!followUp) return

        setSending(true)
        setNotice(null)
        try {
            const response = await fetch(`/api/reservation/${followUp.id}/follow-up`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ message })
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || "Failed to send follow-up")

            setNotice({ type: "success", text: data.message || "Follow-up sent." })
            setFollowUp(null)
            setMessage("")
        } catch (error) {
            setNotice({ type: "error", text: error.message })
        } finally {
            setSending(false)
        }
    }

    if (loading) return <PageSkeleton label="Loading your reservations" stats={2} rows={5} columns={5} />

    return (
        <div className="schedule-page">
            <div className="schedule-hero">
                <div>
                    <h1>{PAGE_TITLES.myReservations}</h1>
                    <p>Every laboratory reservation you submitted, including pending requests and their status.</p>
                </div>
                <div className="hero-meta">
                    <span className="hero-chip"><CalendarClock size={14} /> {counts.pending} pending</span>
                    <span className="hero-chip"><ClipboardList size={14} /> {counts.approved} approved</span>
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
                        <h2>My Requests</h2>
                        <p>Cancel a request you no longer need, or send a follow-up to the admin.</p>
                    </div>
                    <Link to="/bookings" className="primary-btn" style={{ textDecoration: "none" }}>
                        + New Reservation
                    </Link>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "16px 20px" }}>
                    {FILTERS.map((value) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setFilter(value)}
                            className={filter === value ? "primary-btn" : "ghost-btn"}
                            style={{ textTransform: "capitalize", height: 36 }}
                        >
                            {value}
                        </button>
                    ))}
                    <div className="search-input-wrapper" style={{ marginLeft: "auto", minWidth: 220, flex: "1 1 220px" }}>
                        <Search size={16} />
                        <input
                            type="text"
                            placeholder="Search room or purpose..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            style={{ height: 36, width: "100%" }}
                        />
                    </div>
                </div>

                {visible.length === 0 ? (
                    <div className="schedule-empty">
                        <ClipboardList size={32} color="#94a3b8" />
                        <h3>No reservations to show</h3>
                        <p>
                            {reservations.length === 0
                                ? "You have not submitted a laboratory reservation yet."
                                : "No reservation matches these filters."}
                        </p>
                    </div>
                ) : (
                    <div className="schedule-table-wrapper">
                        <table className="schedule-table" style={{ minWidth: 780 }}>
                            <thead>
                                <tr>
                                    <th>Laboratory</th>
                                    <th>Section</th>
                                    <th>Schedule</th>
                                    <th>Purpose</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((reservation) => {
                                    const colors = statusStyle(reservation.status)
                                    const start = parseLocal(reservation.start)
                                    const end = parseLocal(reservation.end)
                                    const canCancel = ["pending", "approved"].includes(reservation.status)

                                    return (
                                        <tr key={reservation.id}>
                                            <td style={{ fontWeight: 700, color: "var(--navy-900)" }}>{reservation.room}</td>
                                            <td>{reservation.section || "—"}</td>
                                            <td>
                                                <div style={{ color: "var(--text-soft)", fontWeight: 600 }}>{start.toLocaleDateString()}</div>
                                                <div className="muted" style={{ color: "var(--text-muted)", fontSize: 12 }}>
                                                    {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                </div>
                                            </td>
                                            <td>
                                                {reservation.purpose || "N/A"}
                                                {reservation.purpose_notes && (
                                                    <div className="muted" style={{ color: "var(--text-muted)", fontSize: 12 }}>{reservation.purpose_notes}</div>
                                                )}
                                            </td>
                                            <td>
                                                <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, backgroundColor: colors.bg, color: colors.text, textTransform: "capitalize" }}>
                                                    {reservation.status}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="row-actions">
                                                    <button
                                                        type="button"
                                                        className="ghost-btn"
                                                        disabled={!canCancel}
                                                        onClick={() => cancelReservation(reservation)}
                                                        style={{ height: 34, padding: "0 12px" }}
                                                    >
                                                        <X size={14} /> {canceling === String(reservation.id) ? "Cancelling..." : "Cancel"}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="primary-btn"
                                                        disabled={reservation.status !== "pending"}
                                                        onClick={() => { setFollowUp(reservation); setMessage("") }}
                                                        style={{ height: 34, padding: "0 12px" }}
                                                    >
                                                        <BellRing size={14} /> Follow up
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <Modal
                isOpen={Boolean(followUp)}
                onClose={() => setFollowUp(null)}
                title="Follow up with the admin"
            >
                <form onSubmit={sendFollowUp} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13.5 }}>
                        {followUp?.room} · {followUp ? parseLocal(followUp.start).toLocaleString() : ""}
                    </p>
                    <div className="form-field">
                        <label>Message (optional)</label>
                        <textarea
                            rows={3}
                            value={message}
                            onChange={(event) => setMessage(event.target.value)}
                            maxLength={500}
                            placeholder="e.g. We need the room confirmed earlier for an exam."
                            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
                        />
                    </div>
                    <div className="form-actions">
                        <button type="button" className="ghost-btn" onClick={() => setFollowUp(null)}>Cancel</button>
                        <button type="submit" className="primary-btn" disabled={sending}>
                            <Send size={15} /> {sending ? "Sending..." : "Send follow-up"}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}

export default MyReservations
