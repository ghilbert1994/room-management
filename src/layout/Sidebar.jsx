/* eslint-disable react-hooks/set-state-in-effect */
import './Sidebar.css'
import logo from '../assets/logo.png'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
    LayoutDashboardIcon,
    LogOut,
    BookIcon,
    Calendar,
    RobotArm,
    Wrench,
    Settings,
    ChartBar,
    ClipboardList,
    CalendarDays,
    CalendarRange,
    ShieldCheck,
    KeyRound,
    Users,
    History,
    ChevronDown,
    X
} from 'lucide-react'
import { UserContext } from '../auth/UserContext.jsx'
import { useContext, useEffect, useState } from 'react'
import { normalizeRole } from '../auth/roles.js'
import { ROUTES, routeByKey } from '../lib/routes.js'

const ROUTE_ICONS = {
    dashboard: LayoutDashboardIcon,
    classSchedule: CalendarDays,
    universityCalendar: CalendarRange,
    labSchedule: Calendar,
    reservations: BookIcon,
    manageReservations: ClipboardList,
    reservationHistory: History,
    scheduleManager: ShieldCheck,
    inviteCodes: KeyRound,
    userManagement: Users,
    labManagement: RobotArm,
    facilityIssues: Wrench,
    analytics: ChartBar,
    settings: Settings
}

// Sidebar navigation is grouped so 12 flat rows become 5 collapsible sections.
// A group with a single visible page renders as a plain link (no chevron).
const NAV_GROUPS = [
    { id: "overview", label: "Overview", keys: ["dashboard"] },
    { id: "schedules", label: "Schedules", keys: ["classSchedule", "labSchedule", "universityCalendar"] },
    { id: "reservations", label: "Reservations", keys: ["manageReservations", "reservationHistory"] },
    { id: "administration", label: "Administration", keys: ["scheduleManager", "labManagement", "facilityIssues", "inviteCodes", "userManagement", "analytics"] },
    { id: "system", label: "System", keys: ["settings"] }
]

const STORAGE_KEY = "labease:sidebar-group"

const readStoredGroup = () => {
    try {
        return window.localStorage.getItem(STORAGE_KEY)
    } catch {
        return null
    }
}

function Sidebar({ isOpen = false, onClose }) {
    const { user, setUser } = useContext(UserContext)
    const navigate = useNavigate()
    const { pathname } = useLocation()
    const role = normalizeRole(user?.role)
    const [openGroupId, setOpenGroupId] = useState(readStoredGroup)

    const visibleRoutes = (keys) =>
        keys
            .map((key) => routeByKey(key))
            .filter((route) => route && (route.roles || []).includes(role))

    const activeKey = ROUTES.find((route) => route.path === pathname)?.key
    const activeGroupId = NAV_GROUPS.find((group) => group.keys.includes(activeKey))?.id

    // Keep the section that owns the current page expanded.
    useEffect(() => {
        if (activeGroupId) setOpenGroupId(activeGroupId)
    }, [activeGroupId])

    const toggleGroup = (groupId) => {
        setOpenGroupId((current) => {
            const next = current === groupId ? null : groupId
            try {
                if (next) window.localStorage.setItem(STORAGE_KEY, next)
                else window.localStorage.removeItem(STORAGE_KEY)
            } catch {
                // Private mode / storage disabled: state still works for this session.
            }
            return next
        })
    }

    const handleLogout = async (event) => {
        event.preventDefault()
        await fetch('/api/auth/logout', { method: "POST", credentials: "include" })
        setUser(null)
        navigate("/login", { replace: true })
    }

    const renderLink = (route, grouped) => {
        const Icon = ROUTE_ICONS[route.key] || LayoutDashboardIcon
        return (
            <li key={route.key}>
                <NavLink
                    to={route.path}
                    onClick={onClose}
                    className={({ isActive }) => `${isActive ? "active" : ""}${grouped ? " sidebar-sub-link" : ""}`}
                >
                    <Icon /> {route.title}
                </NavLink>
            </li>
        )
    }

    const canCreateReservation = Boolean(routeByKey("reservations")?.roles.includes(role))

    return (
        <div className={`sidebar-container ${isOpen ? "sidebar-open" : ""}`}>
            <div className="sidebar-title">
                <img src={logo} alt="Logo" />
                <h3>LabEase</h3>
                <button className="sidebar-close" type="button" onClick={onClose} aria-label="Close navigation">
                    <X size={18} />
                </button>
            </div>

            <nav className="sidebar-items">
                <ul>
                    {NAV_GROUPS.map((group) => {
                        const routes = visibleRoutes(group.keys)
                        if (routes.length === 0) return null

                        if (routes.length === 1) return renderLink(routes[0], false)

                        const expanded = openGroupId === group.id
                        const groupId = `sidebar-group-${group.id}`

                        return (
                            <li key={group.id} className="sidebar-group">
                                <button
                                    type="button"
                                    className="sidebar-group-toggle"
                                    aria-expanded={expanded}
                                    aria-controls={groupId}
                                    onClick={() => toggleGroup(group.id)}
                                >
                                    <span>{group.label}</span>
                                    <ChevronDown className="sidebar-group-chevron" size={15} />
                                </button>
                                {expanded && (
                                    <ul id={groupId} className="sidebar-group-items">
                                        {routes.map((route) => renderLink(route, true))}
                                    </ul>
                                )}
                            </li>
                        )
                    })}
                </ul>
            </nav>

            <div className="sidebar-bottom">
                {canCreateReservation && (
                    <NavLink className="new-booking" to="/bookings" onClick={onClose}>
                        + New Reservation
                    </NavLink>
                )}

                <button className="logout" onClick={handleLogout}>
                    <LogOut size={18} />
                    Log Out
                </button>
            </div>
        </div>
    )
}

export default Sidebar
