# UI Terminology and Navigation

The panel flagged three related problems: the sidebar had too many flat items,
the sidebar label did not match the heading inside the page, and the app mixed
"Lab", "Laboratory", "Booking", and "Reservation".

## Rules

1. **Laboratory**, never "Lab", in navigation, headings, and buttons.
2. **Reservation**, never "Booking", for the booking workflow. The table
   (`reservations`), the API (`/api/reservation/*`), and the form already used
   that word; only the UI drifted.
3. **One name per page.** `src/lib/pageTitles.js` is the single source. The
   sidebar, the navbar, and the page `<h1>` all read from it, so they cannot
   disagree again.

## Canonical page names

| Route | Sidebar group | Display name |
|---|---|---|
| `/dashboard` | Overview | Dashboard |
| `/class-schedule` | Schedules | Class Schedule |
| `/lab-schedule` | Schedules | Laboratory Schedule |
| `/university-calendar` | Schedules | University Calendar |
| `/bookings` | Reservations (gold button) | Laboratory Reservation |
| `/manage-bookings` | Reservations | Manage Reservations |
| `/reservations/history` | Reservations | Reservation History |
| `/admin/schedules` | Administration | Schedule Management |
| `/admin/labs` | Administration | Laboratory Management |
| `/admin/issues` | Administration | Facility Issues |
| `/admin/users` | Administration | User Management |
| `/admin/registration-codes` | Administration | User Account Codes |
| `/admin/analytics` | Administration | Analytics Reports |
| `/settings` | System | Settings |

## What was renamed

| Before | After |
|---|---|
| Lab Schedule (sidebar) / Laboratory Schedule Viewer (h1) | Laboratory Schedule |
| Lab Reservation (sidebar) / Lab Reservations (h1) | Laboratory Reservation |
| Manage Bookings / Review Lab Requests / Manage All Bookings | Manage Reservations |
| Lab Management / Computer Laboratory Status | Laboratory Management |
| Settings / System Settings | Settings |
| Analytics Reports (no heading) | Analytics Reports (heading added) |
| "Total Bookings", "Bookings by Day", "My Upcoming Bookings" | "Total Reservations", "Reservations by Day", "My Upcoming Reservations" |

## Navigation structure

Twelve flat sidebar rows became five sections:

- **Overview** — Dashboard
- **Schedules** — Class Schedule, Laboratory Schedule, University Calendar
- **Reservations** — Manage Reservations, Reservation History (plus the
  "+ New Reservation" button in the sidebar footer)
- **Administration** — Schedule Management, Laboratory Management, Registration
  Codes, User Management, Analytics Reports
- **System** — Settings

Behaviour:

- Only the section that owns the current page is expanded by default; the
  selection is remembered in `localStorage`.
- A section the signed-in role cannot see is not rendered at all, so a student
  sees Schedules + Settings only.
- A section with a single visible page renders as a plain link, without a
  chevron or an empty expandable container.
- Group headers expose `aria-expanded` / `aria-controls`; the chevron rotates
  to show state.

## Where a page name comes from

```
src/lib/pageTitles.js   →  PAGE_TITLES[key]
        │
        ├── src/lib/routes.js   → navbar title (App.jsx passes route.title)
        ├── src/layout/Sidebar.jsx → sidebar label
        └── src/mainpage/*.jsx  → page <h1>
```

Adding or renaming a page means editing `pageTitles.js` and `routes.js` only.
