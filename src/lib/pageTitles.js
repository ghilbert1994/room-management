// Single source of truth for every user-facing page name.
//
// The sidebar, the navbar (via ROUTES) and each page heading all read from this
// file. Before this existed the three disagreed ("Lab Schedule" vs "Laboratory
// Schedule Viewer" vs "Laboratory Schedule"), which is what the panel flagged.
//
// Terminology rules:
//   * "Laboratory", never "Lab", in page titles and navigation.
//   * "Reservation", never "Booking", for the booking workflow.
export const PAGE_TITLES = {
    dashboard: "Dashboard",
    classSchedule: "Class Schedule",
    myClassSchedule: "My Class Schedule",
    universityCalendar: "University Calendar",
    labSchedule: "Laboratory Schedule",
    reservations: "Laboratory Reservation",
    manageReservations: "Manage Reservations",
    myReservations: "My Reservations",
    reservationHistory: "Reservation History",
    scheduleManager: "Schedule Management",
    inviteCodes: "User Account Codes",
    userManagement: "User Management",
    labManagement: "Room Management",
    facilityIssues: "Facility Issues",
    analytics: "Analytics Reports",
    settings: "Settings"
}

// Some pages are named differently for some roles. The same page is
// "Facility Issues" for staff but "Report an Issue" for faculty and students.
const ROLE_TITLES = {
    facilityIssues: {
        faculty: "Report an Issue",
        student: "Report an Issue"
    }
}

export const pageTitle = (key) => PAGE_TITLES[key] || "LabEase"

export const pageTitleFor = (key, role) => ROLE_TITLES[key]?.[role] || pageTitle(key)
