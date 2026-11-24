import { lazy } from "react"
import permissions from "../../shared/permissions.json"
import { PAGE_TITLES } from "./pageTitles.js"

const Dashboard = lazy(() => import("../mainpage/Dashboard.jsx"))
const LabManagement = lazy(() => import("../mainpage/LabManagement.jsx"))
const FacilityIssues = lazy(() => import("../mainpage/FacilityIssues.jsx"))
const Settings = lazy(() => import("../mainpage/Settings.jsx"))
const ScheduleViewer = lazy(() => import("../mainpage/ScheduleViewer.jsx"))
const SemesterSchedule = lazy(() => import("../mainpage/SemesterSchedule.jsx"))
const MyClassSchedule = lazy(() => import("../mainpage/MyClassSchedule.jsx"))
const MyReservations = lazy(() => import("../mainpage/MyReservations.jsx"))
const MasterSchedule = lazy(() => import("../mainpage/MasterSchedule.jsx"))
const ScheduleManager = lazy(() => import("../mainpage/ScheduleManager.jsx"))
const InviteCodes = lazy(() => import("../mainpage/InviteCodes.jsx"))
const UserManagement = lazy(() => import("../mainpage/UserManagement.jsx"))
const AnalyticsReports = lazy(() => import("../mainpage/AnalyticsReports.jsx"))
const Reservation = lazy(() => import("../mainpage/Reservation.jsx"))
const BookingsManager = lazy(() => import("../mainpage/BookingsManager.jsx"))
const ReservationHistory = lazy(() => import("../mainpage/ReservationHistory.jsx"))

// `key` is both the sidebar grouping key and the permissions.json page key.
// `title` is the one display name used by the navbar, the sidebar, and the page.
export const ROUTES = [
    {
        key: "dashboard",
        path: "/dashboard",
        title: PAGE_TITLES.dashboard,
        component: Dashboard,
        roles: permissions.pages.dashboard
    },
    {
        key: "classSchedule",
        path: "/class-schedule",
        title: PAGE_TITLES.classSchedule,
        component: SemesterSchedule,
        roles: permissions.pages.classSchedule
    },
    {
        key: "myClassSchedule",
        path: "/my-class-schedule",
        title: PAGE_TITLES.myClassSchedule,
        component: MyClassSchedule,
        roles: permissions.pages.myClassSchedule
    },
    {
        key: "universityCalendar",
        path: "/university-calendar",
        title: PAGE_TITLES.universityCalendar,
        component: MasterSchedule,
        roles: permissions.pages.universityCalendar
    },
    {
        key: "labSchedule",
        path: "/lab-schedule",
        title: PAGE_TITLES.labSchedule,
        component: ScheduleViewer,
        roles: permissions.pages.labSchedule
    },
    {
        key: "reservations",
        path: "/bookings",
        title: PAGE_TITLES.reservations,
        component: Reservation,
        roles: permissions.pages.reservations
    },
    {
        key: "manageReservations",
        path: "/manage-bookings",
        title: PAGE_TITLES.manageReservations,
        component: BookingsManager,
        roles: permissions.pages.manageReservations
    },
    {
        key: "myReservations",
        path: "/my-reservations",
        title: PAGE_TITLES.myReservations,
        component: MyReservations,
        roles: permissions.pages.myReservations
    },
    {
        key: "reservationHistory",
        path: "/reservations/history",
        title: PAGE_TITLES.reservationHistory,
        component: ReservationHistory,
        roles: permissions.pages.reservationHistory
    },
    {
        key: "scheduleManager",
        path: "/admin/schedules",
        title: PAGE_TITLES.scheduleManager,
        component: ScheduleManager,
        roles: permissions.pages.scheduleManager
    },
    {
        key: "inviteCodes",
        path: "/admin/registration-codes",
        title: PAGE_TITLES.inviteCodes,
        component: InviteCodes,
        roles: permissions.pages.inviteCodes
    },
    {
        key: "userManagement",
        path: "/admin/users",
        title: PAGE_TITLES.userManagement,
        component: UserManagement,
        roles: permissions.pages.userManagement
    },
    {
        key: "labManagement",
        path: "/admin/labs",
        title: PAGE_TITLES.labManagement,
        component: LabManagement,
        roles: permissions.pages.labManagement
    },
    {
        key: "facilityIssues",
        path: "/facility-issues",
        title: PAGE_TITLES.facilityIssues,
        component: FacilityIssues,
        roles: permissions.pages.facilityIssues
    },
    {
        key: "analytics",
        path: "/admin/analytics",
        title: PAGE_TITLES.analytics,
        component: AnalyticsReports,
        roles: permissions.pages.analytics
    },
    {
        key: "settings",
        path: "/settings",
        title: PAGE_TITLES.settings,
        component: Settings,
        roles: permissions.pages.settings
    }
]

export const defaultRouteForRole = (role) => {
    if (role === "student") return "/class-schedule"
    if (role === "mis_staff") return "/facility-issues"
    return "/dashboard"
}

export const routeByPath = (pathname) => ROUTES.find((route) => route.path === pathname)

export const routeByKey = (key) => ROUTES.find((route) => route.key === key)
