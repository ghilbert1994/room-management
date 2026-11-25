/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState, useContext } from "react"
import { Link } from "react-router-dom"
import Card from "./Card"
import { Search, MapPin, ClipboardList, Download } from "lucide-react"
import { UserContext } from "../auth/UserContext.jsx"
import { PageSkeleton } from "../layout/Loading.jsx"
import { subscribeToDataChanges } from "../lib/dataEvents.js"
import { PAGE_TITLES } from "../lib/pageTitles.js"
import { EXPORT_FORMATS, exportTable } from "../lib/exportTable.js"

const parseLocal = (value) => {
    if (!value) return new Date()
    if (value instanceof Date) return value
    const str = String(value).trim()
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/)
    if (match) {
        const [, y, mo, d, h, mi, s] = match
        return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s || 0), 0)
    }
    return new Date(str)
}

const toDateInput = (date) => {
    const pad = (n) => String(n).padStart(2, "0")
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const STATUS_FILTERS = ["all", "approved", "rejected", "cancelled", "no_show"]

const STATUS_COLORS = {
    approved: { bg: "#dcfce7", text: "#166534" },
    pending: { bg: "#fef3c7", text: "#d97706" },
    rejected: { bg: "#fef2f2", text: "#dc2626" },
    cancelled: { bg: "var(--surface-muted)", text: "#475569" },
    no_show: { bg: "#fef2f2", text: "#b91c1c" },
    in_progress: { bg: "#dbeafe", text: "#1d4ed8" },
    processing: { bg: "#e0e7ff", text: "#4338ca" }
}

const statusColors = (status) => STATUS_COLORS[status] || { bg: "var(--surface-muted)", text: "var(--text-muted)" }

const statusLabel = (status) => String(status || "").replace(/_/g, " ")

function ReservationHistory() {
    const { labs } = useContext(UserContext)
    const [reservations, setReservations] = useState([])
    const [loading, setLoading] = useState(true)
    const [status, setStatus] = useState("all")
    const [room, setRoom] = useState("all")
    const [from, setFrom] = useState("")
    const [to, setTo] = useState("")
    const [search, setSearch] = useState("")
    const [exportFormat, setExportFormat] = useState("csv")

    const fetchHistory = async () => {
        try {
            const res = await fetch(`/api/reservation/all?scope=history`, { credentials: "include" })
            if (res.ok) {
                const data = await res.json()
                setReservations(data.reservations || [])
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchHistory()
    }, [])

    useEffect(() => {
        return subscribeToDataChanges("bookings:changed", fetchHistory)
    }, [])

    const rows = useMemo(() => {
        const needle = search.trim().toLowerCase()

        return reservations
            .filter((reservation) => {
                if (status !== "all" && reservation.status !== status) return false
                if (room !== "all" && String(reservation.room) !== String(room)) return false

                const start = parseLocal(reservation.start)
                if (from && start < new Date(`${from}T00:00:00`)) return false
                if (to && start > new Date(`${to}T23:59:59`)) return false

                if (!needle) return true
                return [reservation.room, reservation.user, reservation.purpose, reservation.purpose_notes]
                    .some((value) => String(value || "").toLowerCase().includes(needle))
            })
            .sort((a, b) => parseLocal(b.start) - parseLocal(a.start))
    }, [reservations, status, room, from, to, search])

    const exportRows = () => {
        const columns = ["Laboratory", "Reserved By", "Section", "Purpose", "Notes", "Participants", "Start", "End", "Status", "Requested On"]
        const data = rows.map((reservation) => [
            reservation.room,
            reservation.user,
            reservation.section || "",
            reservation.purpose || "",
            reservation.purpose_notes || "",
            reservation.participants ?? "",
            reservation.start,
            reservation.end,
            reservation.status,
            reservation.created_at || ""
        ])

        try {
            exportTable({
                filename: `reservation-history-${toDateInput(new Date())}`,
                title: "Reservation History",
                columns,
                rows: data,
                format: exportFormat
            })
        } catch (error) {
            window.alert(error.message)
        }
    }

    const resetFilters = () => {
        setStatus("all")
        setRoom("all")
        setFrom("")
        setTo("")
        setSearch("")
    }

    if (loading) return <PageSkeleton label="Loading reservation history" stats={4} rows={7} columns={7} />

    return (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "20px" }}>
            <div className="dashboard-title">
                <div className="dashboard-title-left">
                    <label>ARCHIVE</label>
                    <h1 style={{ margin: 0 }}>{PAGE_TITLES.reservationHistory}</h1>
                    <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: "14px" }}>
                        Past and closed reservations. Active requests stay in Manage Reservations.
                    </p>
                </div>
                <Link
                    to="/manage-bookings"
                    style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 16px", borderRadius: "10px", backgroundColor: "var(--navy-900)", color: "#ffffff", textDecoration: "none", fontWeight: "bold", fontSize: "13px" }}
                >
                    <ClipboardList size={16} /> Manage Reservations
                </Link>
            </div>

            <Card>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", marginBottom: "20px" }}>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        {STATUS_FILTERS.map((value) => (
                            <button
                                key={value}
                                onClick={() => setStatus(value)}
                                style={{
                                    padding: "8px 16px",
                                    borderRadius: "8px",
                                    border: "none",
                                    fontWeight: "bold",
                                    cursor: "pointer",
                                    textTransform: "capitalize",
                                    backgroundColor: status === value ? "var(--navy-900)" : "var(--surface-muted)",
                                    color: status === value ? "white" : "var(--text-muted)"
                                }}
                            >
                                {statusLabel(value)}
                            </button>
                        ))}
                    </div>

                    <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                        <select
                            value={exportFormat}
                            onChange={(event) => setExportFormat(event.target.value)}
                            style={{ height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--border-strong)", backgroundColor: "#ffffff", color: "var(--text-soft)", fontWeight: "600" }}
                        >
                            {EXPORT_FORMATS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={exportRows}
                            style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--border-strong)", backgroundColor: "#ffffff", color: "var(--navy-900)", fontWeight: "bold", cursor: "pointer" }}
                        >
                            <Download size={16} /> Export
                        </button>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", marginBottom: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", border: "1px solid var(--border-strong)", borderRadius: "8px", padding: "0 12px", backgroundColor: "var(--surface-muted)" }}>
                        <Search size={18} style={{ color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Search room, user, or purpose..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            style={{ border: "none", background: "transparent", outline: "none", height: "40px", width: "250px", color: "var(--text-soft)" }}
                        />
                    </div>

                    <select
                        value={room}
                        onChange={(event) => setRoom(event.target.value)}
                        style={{ height: "40px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--border-strong)", backgroundColor: "var(--surface-muted)", color: "var(--text-soft)", fontWeight: "600" }}
                    >
                        <option value="all">All laboratories</option>
                        {labs.map((lab) => (
                            <option key={lab.id} value={lab.name}>{lab.name}</option>
                        ))}
                    </select>

                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-muted)", fontWeight: "600" }}>
                        From
                        <input
                            type="date"
                            value={from}
                            onChange={(event) => setFrom(event.target.value)}
                            style={{ height: "40px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--border-strong)", backgroundColor: "var(--surface-muted)", color: "var(--text-soft)" }}
                        />
                    </label>

                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-muted)", fontWeight: "600" }}>
                        To
                        <input
                            type="date"
                            value={to}
                            min={from || undefined}
                            onChange={(event) => setTo(event.target.value)}
                            style={{ height: "40px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--border-strong)", backgroundColor: "var(--surface-muted)", color: "var(--text-soft)" }}
                        />
                    </label>

                    <button
                        type="button"
                        onClick={resetFilters}
                        style={{ height: "40px", padding: "0 14px", borderRadius: "8px", border: "1px solid var(--border-strong)", backgroundColor: "#ffffff", color: "var(--text-muted)", fontWeight: "bold", cursor: "pointer" }}
                    >
                        Reset
                    </button>
                </div>

                <p style={{ margin: "0 0 12px", color: "var(--text-muted)", fontSize: "13px", fontWeight: "600" }}>
                    {rows.length} archived reservation{rows.length === 1 ? "" : "s"}
                </p>

                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", minWidth: "860px", borderCollapse: "collapse", textAlign: "left" }}>
                        <thead>
                            <tr style={{ borderBottom: "2px solid var(--border)" }}>
                                <th style={{ padding: "12px", color: "var(--text-muted)" }}>Laboratory</th>
                                <th style={{ padding: "12px", color: "var(--text-muted)" }}>Reserved By</th>
                                <th style={{ padding: "12px", color: "var(--text-muted)" }}>Section</th>
                                <th style={{ padding: "12px", color: "var(--text-muted)" }}>Schedule</th>
                                <th style={{ padding: "12px", color: "var(--text-muted)" }}>Details</th>
                                <th style={{ padding: "12px", color: "var(--text-muted)" }}>Status</th>
                                <th style={{ padding: "12px", color: "var(--text-muted)" }}>Requested</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)" }}>
                                        No archived reservations match these filters.
                                    </td>
                                </tr>
                            ) : (
                                rows.map((reservation) => {
                                    const colors = statusColors(reservation.status)
                                    const start = parseLocal(reservation.start)
                                    const end = parseLocal(reservation.end)
                                    const requested = reservation.created_at ? parseLocal(reservation.created_at) : null

                                    return (
                                        <tr key={reservation.id} style={{ borderBottom: "1px solid var(--surface-muted)" }}>
                                            <td style={{ padding: "12px", fontWeight: "bold", color: "var(--navy-900)" }}>
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                                    <MapPin size={13} /> {reservation.room}
                                                </span>
                                            </td>
                                            <td style={{ padding: "12px", color: "var(--text-soft)" }}>{reservation.user}</td>
                                            <td style={{ padding: "12px", color: "var(--text-soft)" }}>{reservation.section || "—"}</td>
                                            <td style={{ padding: "12px", fontSize: "13px" }}>
                                                <div style={{ color: "var(--text-soft)", fontWeight: "bold" }}>{start.toLocaleDateString()}</div>
                                                <div style={{ color: "var(--text-muted)" }}>
                                                    {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                </div>
                                            </td>
                                            <td style={{ padding: "12px", fontSize: "13px" }}>
                                                <div style={{ color: "var(--text-soft)" }}><strong>Purpose:</strong> {reservation.purpose || "N/A"}</div>
                                                {reservation.purpose_notes && (
                                                    <div style={{ color: "var(--text-muted)" }}><strong>Notes:</strong> {reservation.purpose_notes}</div>
                                                )}
                                                <div style={{ color: "var(--text-muted)" }}><strong>Pax:</strong> {reservation.participants ?? "N/A"}</div>
                                            </td>
                                            <td style={{ padding: "12px" }}>
                                                <span style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold", backgroundColor: colors.bg, color: colors.text, textTransform: "capitalize" }}>
                                                    {statusLabel(reservation.status)}
                                                </span>
                                                {reservation.status === "cancelled" && (
                                                    <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--text-muted)" }}>
                                                        {reservation.cancelled_by_name ? `By ${reservation.cancelled_by_name}` : ""}
                                                        {reservation.cancelled_at ? ` · ${parseLocal(reservation.cancelled_at).toLocaleDateString()}` : ""}
                                                        {reservation.cancellation_reason ? ` · ${reservation.cancellation_reason}` : ""}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: "12px", fontSize: "13px", color: "var(--text-muted)" }}>
                                                {requested ? requested.toLocaleDateString() : "N/A"}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )
}

export default ReservationHistory
