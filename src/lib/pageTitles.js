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
    universityCalendar: "University Calendar",
    labSchedule: "Laboratory Schedule",
    reservations: "Laboratory Reservation",
    manageReservations: "Manage Reservations",
    reservationHistory: "Reservation History",
    scheduleManager: "Schedule Management",
    inviteCodes: "Registration Codes",
    userManagement: "User Management",
    labManagement: "Laboratory Management",
    analytics: "Analytics Reports",
    settings: "Settings"
}

export const pageTitle = (key) => PAGE_TITLES[key] || "LabEase"
