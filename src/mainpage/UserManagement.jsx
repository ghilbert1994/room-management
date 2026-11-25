/* eslint-disable react-hooks/set-state-in-effect */
import { useContext, useEffect, useMemo, useState } from "react"
import { Check, Copy, KeyRound, Search, ShieldCheck, UserCog, Users } from "lucide-react"
import { UserContext } from "../auth/UserContext.jsx"
import { ROLE_LABELS, normalizeRole } from "../auth/roles.js"
import { PageSkeleton } from "../layout/Loading.jsx"
import { PAGE_TITLES } from "../lib/pageTitles.js"
import "./Schedules.css"

const ROLE_OPTIONS = ["student", "faculty", "mis_staff", "admin"]

const formatDate = (value) => {
    if (!value) return "—"
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString()
}

function UserManagement() {
    const { user: currentUser } = useContext(UserContext)
    const [users, setUsers] = useState([])
    const [sections, setSections] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [search, setSearch] = useState("")
    const [roleFilter, setRoleFilter] = useState("")
    const [resetResult, setResetResult] = useState(null)
    const [resetRequests, setResetRequests] = useState([])
    const [resetLink, setResetLink] = useState(null)
    const [linkCopied, setLinkCopied] = useState(false)
    const [copied, setCopied] = useState(false)

    const loadUsers = async () => {
        try {
            setError("")
            const response = await fetch("/api/admin/users", { credentials: "include" })
            const data = await response.json()
            if (!response.ok) throw new Error(data.message || "Failed to load users")
            setUsers(data.users)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const loadResetRequests = async () => {
        try {
            const response = await fetch("/api/admin/password-resets", { credentials: "include" })
            const data = await response.json()
            if (response.ok) setResetRequests(data.requests || [])
        } catch {
            setResetRequests([])
        }
    }

    useEffect(() => {
        loadUsers()
        loadResetRequests()
        const loadSections = async () => {
            try {
                const response = await fetch("/api/sections", { credentials: "include" })
                const data = await response.json()
                if (response.ok) setSections(data.sections || [])
            } catch {
                setSections([])
            }
        }
        loadSections()
    }, [])

    const updateUser = async (id, patch) => {
        try {
            setError("")
            const endpoint = patch.role
                ? `/api/admin/users/${id}/role`
                : `/api/admin/users/${id}/active`

            const response = await fetch(endpoint, {
                method: "PUT",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch)
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.message || "Failed to update user")
            setUsers((prev) => prev.map((item) => (item.id === data.user.id ? { ...item, ...data.user } : item)))
        } catch (err) {
            setError(err.message)
        }
    }

    const updateSection = async (id, sectionId) => {
        try {
            setError("")
            const response = await fetch(`/api/admin/users/${id}/section`, {
                method: "PUT",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sectionId: sectionId ? Number(sectionId) : null })
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.message || "Failed to update the section")
            setUsers((prev) => prev.map((item) => (item.id === data.user.id ? { ...item, ...data.user } : item)))
        } catch (err) {
            setError(err.message)
        }
    }

    const createResetLink = async (request) => {
        try {
            setError("")
            setLinkCopied(false)
            const response = await fetch(`/api/admin/password-resets/${request.id}/link`, {
                method: "POST",
                credentials: "include"
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.message || "Failed to create a reset link")

            const url = `${window.location.origin}${data.url}`
            setResetLink({ email: request.email, url })
            try {
                await navigator.clipboard.writeText(url)
                setLinkCopied(true)
            } catch {
                setLinkCopied(false)
            }
        } catch (err) {
            setError(err.message)
        }
    }

    const copyResetLink = async () => {
        if (!resetLink) return
        try {
            await navigator.clipboard.writeText(resetLink.url)
            setLinkCopied(true)
        } catch {
            setLinkCopied(false)
        }
    }

    const dismissResetRequest = async (request) => {
        if (!window.confirm(`Dismiss the password reset request for ${request.email}?`)) return
        try {
            setError("")
            const response = await fetch(`/api/admin/password-resets/${request.id}`, {
                method: "DELETE",
                credentials: "include"
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.message || "Failed to dismiss the request")
            await loadResetRequests()
        } catch (err) {
            setError(err.message)
        }
    }

    const resetPassword = async (target) => {
        if (!window.confirm(`Reset the password for ${target.email}?`)) return

        try {
            setError("")
            setCopied(false)
            const response = await fetch(`/api/admin/users/${target.id}/reset-password`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({})
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.message || "Failed to reset password")
            setResetResult({ email: target.email, password: data.temporaryPassword })
        } catch (err) {
            setError(err.message)
        }
    }

    const copyReset = async () => {
        try {
            await navigator.clipboard.writeText(resetResult.password)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 2000)
        } catch {
            setError("Could not copy automatically. Select the password and copy it manually.")
        }
    }

    const filtered = useMemo(() => users.filter((item) => {
        const matchesRole = !roleFilter || normalizeRole(item.role) === roleFilter
        const needle = search.trim().toLowerCase()
        const matchesSearch = !needle
            || String(item.name || "").toLowerCase().includes(needle)
            || String(item.email || "").toLowerCase().includes(needle)
        return matchesRole && matchesSearch
    }), [users, roleFilter, search])

    if (loading) {
        return <PageSkeleton label="Loading users" stats={3} rows={6} columns={5} />
    }

    return (
        <div className="schedule-page">
            <div className="schedule-hero">
                <div>
                    <h1>{PAGE_TITLES.userManagement}</h1>
                    <p>
                        Review accounts, change roles, deactivate access, and issue temporary
                        passwords without touching the database.
                    </p>
                </div>
                <div className="hero-meta">
                    <span className="hero-chip"><ShieldCheck size={14} /> Admin only</span>
                    <span className="hero-chip"><Users size={14} /> {users.length} accounts</span>
                </div>
            </div>

            {error && <div className="schedule-error">{error}</div>}

            {resetResult && (
                <div className="invite-code-box">
                    <div>
                        <div className="invite-code-value">{resetResult.password}</div>
                        <p className="invite-code-note">
                            Temporary password for {resetResult.email}. Ask them to change it after signing in.
                        </p>
                    </div>
                    <button type="button" className="ghost-btn" onClick={copyReset}>
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                        {copied ? "Copied" : "Copy"}
                    </button>
                </div>
            )}

            <div className="schedule-card">
                <div className="schedule-card-header">
                    <div>
                        <h2>Password Reset Requests</h2>
                        <p>No email service is configured yet — create a link and send it to the user.</p>
                    </div>
                </div>

                {resetLink && (
                    <div className="invite-code-box" style={{ margin: 16 }}>
                        <div style={{ minWidth: 0 }}>
                            <div className="invite-code-note">Reset link for {resetLink.email}</div>
                            <div style={{ wordBreak: 'break-all', fontSize: 13, color: 'var(--navy-900)' }}>{resetLink.url}</div>
                        </div>
                        <button type="button" className="ghost-btn" onClick={copyResetLink}>
                            {linkCopied ? <Check size={16} /> : <Copy size={16} />}
                            {linkCopied ? "Copied" : "Copy"}
                        </button>
                    </div>
                )}

                {resetRequests.length === 0 ? (
                    <div className="schedule-empty">
                        <KeyRound size={32} color="#94a3b8" />
                        <h3>No pending requests</h3>
                        <p>Requests submitted from the Forgot Password page appear here.</p>
                    </div>
                ) : (
                    <div className="schedule-table-wrapper">
                        <table className="schedule-table" style={{ minWidth: 720 }}>
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Requested</th>
                                    <th>Expires</th>
                                    <th style={{ textAlign: "right" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {resetRequests.map((request) => (
                                    <tr key={request.id}>
                                        <td>
                                            <div className="subject-name">{request.name || "Unnamed"}</div>
                                            <div className="muted">{request.email}</div>
                                        </td>
                                        <td>{new Date(request.created_at).toLocaleString()}</td>
                                        <td>{new Date(request.expires_at).toLocaleString()}</td>
                                        <td style={{ textAlign: "right" }}>
                                            <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                                                <button type="button" className="ghost-btn" onClick={() => createResetLink(request)}>
                                                    <KeyRound size={15} /> Create link
                                                </button>
                                                <button type="button" className="ghost-btn" onClick={() => dismissResetRequest(request)}>
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

            <div className="schedule-toolbar">
                <div className="schedule-field">
                    <label>Role</label>
                    <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                        <option value="">All roles</option>
                        {ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                        ))}
                    </select>
                </div>
                <div className="schedule-field grow">
                    <label>Search</label>
                    <div className="search-input-wrapper">
                        <Search size={16} />
                        <input
                            type="search"
                            placeholder="Name or email..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="schedule-card">
                <div className="schedule-card-header">
                    <div>
                        <h2>Accounts</h2>
                        <p>{filtered.length} shown</p>
                    </div>
                </div>

                <div className="schedule-table-wrapper">
                    <table className="schedule-table" style={{ minWidth: 1000 }}>
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Role</th>
                                <th>Section</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th style={{ textAlign: "right" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((item) => {
                                const isSelf = String(item.id) === String(currentUser?.id)
                                return (
                                    <tr key={item.id}>
                                        <td>
                                            <div className="subject-name">{item.name || "Unnamed"}</div>
                                            <div className="muted">{item.email}</div>
                                        </td>
                                        <td>
                                            <select
                                                className="inline-select"
                                                value={normalizeRole(item.role)}
                                                disabled={isSelf}
                                                onChange={(event) => updateUser(item.id, { role: event.target.value })}
                                            >
                                                {ROLE_OPTIONS.map((role) => (
                                                    <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            {normalizeRole(item.role) === "student" ? (
                                                <select
                                                    className="inline-select"
                                                    value={item.section_id || ""}
                                                    onChange={(event) => updateSection(item.id, event.target.value)}
                                                >
                                                    <option value="">No section</option>
                                                    {sections.map((section) => (
                                                        <option key={section.id} value={section.id}>{section.label}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <span className="muted">—</span>
                                            )}
                                        </td>
                                        <td>
                                            <span className={`status-badge ${item.is_active ? "active" : "revoked"}`}>
                                                {item.is_active ? "Active" : "Inactive"}
                                            </span>
                                        </td>
                                        <td>{formatDate(item.created_at)}</td>
                                        <td>
                                            <div className="row-actions">
                                                <button
                                                    type="button"
                                                    className="ghost-btn"
                                                    onClick={() => resetPassword(item)}
                                                    title="Reset password"
                                                >
                                                    <KeyRound size={15} /> Reset
                                                </button>
                                                <button
                                                    type="button"
                                                    className={item.is_active ? "danger-btn" : "ghost-btn"}
                                                    disabled={isSelf}
                                                    onClick={() => updateUser(item.id, { is_active: !item.is_active })}
                                                >
                                                    <UserCog size={15} /> {item.is_active ? "Deactivate" : "Activate"}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                {filtered.length === 0 && (
                    <div className="schedule-empty">
                        <Users size={32} color="#94a3b8" />
                        <h3>No matching accounts</h3>
                        <p>Try a different role or search term.</p>
                    </div>
                )}
            </div>
        </div>
    )
}

export default UserManagement
