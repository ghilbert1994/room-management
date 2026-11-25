/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react"
import { Activity, Download, Search, ScrollText, User } from "lucide-react"
import "./Schedules.css"
import { PAGE_TITLES } from "../lib/pageTitles.js"
import { EXPORT_FORMATS, exportTable } from "../lib/exportTable.js"

const PAGE_SIZE = 25

const formatDate = (value) => {
    if (!value) return "—"
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

const actionTone = (action = "") => {
    if (action.startsWith("login") || action.startsWith("logout") || action.startsWith("password") || action === "register") {
        return { bg: "#dbeafe", text: "#1d4ed8" }
    }
    if (action.startsWith("reservation")) return { bg: "#dcfce7", text: "#166534" }
    if (action.startsWith("room") || action.startsWith("unit")) return { bg: "#fef3c7", text: "#b45309" }
    if (action.startsWith("schedule") || action.startsWith("semester") || action.startsWith("event")) {
        return { bg: "#ede9fe", text: "#5b21b6" }
    }
    if (action.startsWith("user") || action.startsWith("invite")) return { bg: "#fee2e2", text: "#b91c1c" }
    if (action.startsWith("report")) return { bg: "#ccfbf1", text: "#0f766e" }
    return { bg: "#f1f5f9", text: "#475569" }
}

const roleLabel = (role) => String(role || "").replace(/_/g, " ")

const emptyFilters = { q: "", action: "", entity: "", from: "", to: "" }

function ActivityLog() {
    const [logs, setLogs] = useState([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [filters, setFilters] = useState(emptyFilters)
    const [searchInput, setSearchInput] = useState("")
    const [actions, setActions] = useState([])
    const [entities, setEntities] = useState([])
    const [loading, setLoading] = useState(true)
    const [exporting, setExporting] = useState(false)
    const [error, setError] = useState("")
    const [exportFormat, setExportFormat] = useState("csv")

    const buildParams = (limit = PAGE_SIZE, targetPage = page) => {
        const params = new URLSearchParams({ page: String(targetPage), limit: String(limit) })
        Object.entries(filters).forEach(([key, value]) => {
            if (value) params.set(key, value)
        })
        return params
    }

    const loadLogs = async () => {
        try {
            setLoading(true)
            setError("")
            const response = await fetch(`/api/admin/activity-logs?${buildParams()}`, { credentials: "include" })
            const data = await response.json()
            if (!response.ok) throw new Error(data.message || "Failed to load the activity log")
            setLogs(data.logs || [])
            setTotal(data.total || 0)
            setActions(data.actions || [])
            setEntities(data.entities || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadLogs()
    }, [page, filters])

    useEffect(() => {
        if (searchInput === filters.q) return undefined
        const timer = setTimeout(() => {
            setPage(1)
            setFilters((previous) => ({ ...previous, q: searchInput }))
        }, 350)
        return () => clearTimeout(timer)
    }, [searchInput])

    const updateFilter = (key, value) => {
        setPage(1)
        setFilters((previous) => ({ ...previous, [key]: value }))
    }

    const resetFilters = () => {
        setSearchInput("")
        setPage(1)
        setFilters(emptyFilters)
    }

    const exportLogs = async () => {
        try {
            setExporting(true)
            setError("")
            const response = await fetch(`/api/admin/activity-logs?${buildParams(200, 1)}`, { credentials: "include" })
            const data = await response.json()
            if (!response.ok) throw new Error(data.message || "Failed to export the activity log")

            exportTable({
                filename: `activity-log-${new Date().toISOString().slice(0, 10)}`,
                title: "Activity Log",
                columns: ["Date & Time", "User", "Email", "Role", "Action", "Entity", "Description", "IP"],
                rows: (data.logs || []).map((log) => [
                    formatDate(log.created_at),
                    log.actor_name || "System",
                    log.actor_email || "",
                    roleLabel(log.actor_role),
                    log.action,
                    log.entity_type ? `${log.entity_type}${log.entity_id ? ` #${log.entity_id}` : ""}` : "",
                    log.description,
                    log.ip_address || ""
                ]),
                format: exportFormat
            })
        } catch (err) {
            setError(err.message)
        } finally {
            setExporting(false)
        }
    }

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
    const lastRow = Math.min(page * PAGE_SIZE, total)

    return (
        <div className="schedule-page">
            <div className="schedule-hero">
                <div>
                    <h1>{PAGE_TITLES.activityLog}</h1>
                    <p>
                        Who signed in, what they changed, and when. Every entry keeps the user's
                        name and role at the time of the action.
                    </p>
                </div>
                <div className="hero-meta">
                    <span className="hero-chip"><Activity size={14} /> {total} entr{total === 1 ? "y" : "ies"}</span>
                    <span className="hero-chip"><ScrollText size={14} /> Page {page} of {totalPages}</span>
                </div>
            </div>

            {error && <div className="schedule-error">{error}</div>}

            <div className="schedule-card">
                <div className="schedule-card-header">
                    <div>
                        <h2>Filters</h2>
                        <p>Search by user, action, entity, or date range.</p>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <select
                            value={exportFormat}
                            onChange={(event) => setExportFormat(event.target.value)}
                            style={{ height: 38, padding: "0 10px", borderRadius: 8, border: "1px solid var(--border-strong)", fontWeight: 600, color: "var(--text-soft)" }}
                        >
                            {EXPORT_FORMATS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        <button type="button" className="ghost-btn" onClick={exportLogs} disabled={exporting}>
                            <Download size={15} /> {exporting ? "Exporting..." : "Export"}
                        </button>
                    </div>
                </div>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", padding: "16px 20px" }}>
                    <div className="schedule-field" style={{ flex: "1 1 240px", minWidth: 200 }}>
                        <label>Search</label>
                        <div className="search-input-wrapper">
                            <Search size={16} />
                            <input
                                type="text"
                                placeholder="User, email, action, or description..."
                                value={searchInput}
                                onChange={(event) => setSearchInput(event.target.value)}
                            />
                        </div>
                    </div>

                    <div className="schedule-field" style={{ minWidth: 180 }}>
                        <label>Action</label>
                        <select value={filters.action} onChange={(event) => updateFilter("action", event.target.value)}>
                            <option value="">All actions</option>
                            {actions.map((action) => (
                                <option key={action} value={action}>{action}</option>
                            ))}
                        </select>
                    </div>

                    <div className="schedule-field" style={{ minWidth: 160 }}>
                        <label>Entity</label>
                        <select value={filters.entity} onChange={(event) => updateFilter("entity", event.target.value)}>
                            <option value="">All entities</option>
                            {entities.map((entity) => (
                                <option key={entity} value={entity}>{entity}</option>
                            ))}
                        </select>
                    </div>

                    <div className="schedule-field" style={{ minWidth: 150 }}>
                        <label>From</label>
                        <input type="date" value={filters.from} onChange={(event) => updateFilter("from", event.target.value)} />
                    </div>

                    <div className="schedule-field" style={{ minWidth: 150 }}>
                        <label>To</label>
                        <input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => updateFilter("to", event.target.value)} />
                    </div>

                    <button type="button" className="ghost-btn" onClick={resetFilters} style={{ height: 40 }}>Reset</button>
                </div>
            </div>

            <div className="schedule-card">
                <div className="schedule-card-header">
                    <div>
                        <h2>Log Entries</h2>
                        <p>Showing {firstRow}–{lastRow} of {total}</p>
                    </div>
                </div>

                {loading ? (
                    <div className="schedule-empty"><p>Loading activity...</p></div>
                ) : logs.length === 0 ? (
                    <div className="schedule-empty">
                        <ScrollText size={32} color="#94a3b8" />
                        <h3>No activity yet</h3>
                        <p>Actions performed in LabEase will appear here.</p>
                    </div>
                ) : (
                    <div className="schedule-table-wrapper">
                        <table className="schedule-table" style={{ minWidth: 1040 }}>
                            <thead>
                                <tr>
                                    <th>Date &amp; Time</th>
                                    <th>User</th>
                                    <th>Action</th>
                                    <th>Entity</th>
                                    <th>Description</th>
                                    <th>IP</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => {
                                    const tone = actionTone(log.action)
                                    return (
                                        <tr key={log.id}>
                                            <td style={{ whiteSpace: "nowrap" }}>{formatDate(log.created_at)}</td>
                                            <td>
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, color: "var(--navy-900)" }}>
                                                    <User size={14} /> {log.actor_name || "System"}
                                                </span>
                                                <div className="muted">{log.actor_email || "—"}</div>
                                                <div className="muted" style={{ textTransform: "capitalize" }}>{roleLabel(log.actor_role) || "—"}</div>
                                            </td>
                                            <td>
                                                <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 800, backgroundColor: tone.bg, color: tone.text }}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td>
                                                {log.entity_type ? (
                                                    <>
                                                        {log.entity_type}
                                                        {log.entity_id ? <div className="muted">#{log.entity_id}</div> : null}
                                                    </>
                                                ) : "—"}
                                            </td>
                                            <td style={{ maxWidth: 380 }}>{log.description}</td>
                                            <td style={{ color: "var(--text-muted)", fontSize: 12.5 }}>{log.ip_address || "—"}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderTop: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Page {page} of {totalPages}</span>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" className="ghost-btn" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                            Previous
                        </button>
                        <button type="button" className="ghost-btn" disabled={page >= totalPages || loading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ActivityLog
