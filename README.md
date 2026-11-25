# LabEase

**Laboratory and room management for La Consolacion University Philippines (LCUP).**

**Status:** Delivered / Freelance Project
**Client:** La Consolacion University Philippines (LCUP)

## Project Overview
LabEase is a full-stack web application designed to streamline the scheduling, maintenance tracking, and analytics for university computer laboratories. It was built to address specific administrative requirements, including role-based access, coordinator approval workflows, and real-time facility monitoring.

## Key Features
- Role-Based Access Control (RBAC): Distinct interfaces for Students, Faculty, MIS Staff, and Admins.
- Class Sections: sections (course + year + section) are kept in sync from the class schedule; students pick theirs at registration, faculty choose one when reserving, and reports record the section that was scheduled.
- Comprehensive Reservation System: Prevents double-booking, restricts past dates, and captures purpose, participants, section, and time.
- Admin-Only Approvals: the admin reviews and approves or rejects every reservation request; faculty track their own submissions in My Reservations.
- Classroom and Laboratory Rooms: rooms are typed, so class schedules can use classrooms while reservations are limited to laboratories.
- My Class Schedule: each faculty member sees only their own weekly timetable, with day columns and time rows.
- Teacher-First Scheduling: the admin picks a teacher, then adds or edits that teacher's classes directly on their timetable.
- Schedule Conflict Protection: overlapping room, instructor, or section assignments are rejected, along with classroom/laboratory mismatches.
- Controlled Reservation Purpose: the purpose is chosen from a maintained list (`reservation_purposes`) instead of free text, so reports group correctly.
- Reservation History / Archive: past and closed reservations move to a filterable, exportable history view, keeping the active queue short.
- Facility Issue Notifications: putting a room under maintenance or reporting a unit broken notifies every active student, and marks the issue resolved with a follow-up notice.
- Faculty Equipment Reports: professors and students report a broken unit, room, or equipment problem; MIS/Admin flag it for maintenance or dismiss it, and the reporter is notified when it is resolved.
- Report Evidence: photos and short videos can be attached to a report, capped at 3 files / 4 MB each / 10 MB total, and viewed by staff and the reporter.
- Export Formats: Reservation History and Analytics export to CSV, Excel (.xls), or PDF (browser print dialog).
- Maintenance Tracking: Toggle whole-room maintenance or track individual unit issues with reasons and expected return dates.
- Live Analytics: Real-time dashboards showing peak usage hours, most-used labs, and overall booking trends.
- Notification System: In-app alerts for new requests and approval status changes.
- Semester Class Schedule: Admin-published, searchable by course, section, year level, subject, instructor, and room.
- Class Blocks in Bookings: staff see semester class slots in the reservation calendar, so conflicts are visible before booking.
- Lab Schedule Viewer: the weekly timetable includes both reservations and semester class blocks; live lab status also considers scheduled classes.
- Per-Date Class Cancellations: the assigned instructor, Admin, or MIS can cancel one class occurrence (e.g., instructor leave), which frees that room and date for booking.
- University Master Calendar: Admin-managed holidays, exams, enrollment periods, and university events.
- User Account Codes: Hashed, expiring, revocable codes protect Faculty, Admin, and MIS Staff sign-ups.
- User Management: Admins can change roles, deactivate accounts, and issue temporary passwords.
- Password Reset: a Forgot Password page creates a single-use, 60-minute reset link; admins can generate the link from User Management when email delivery is not configured.
- Bulk Schedule Import: Paste or upload CSV to publish class schedules quickly.

## Schedules and Role-Based Access

Roles: `student`, `faculty`, `admin`, `mis_staff`.

- `mis_staff` is the laboratory/room operations role. Their navigation is limited to **Facility Issues**, **Room Management**, and **Settings** — room/unit maintenance plus resolving equipment reports. They do not see schedules, analytics, or reservations, and cannot create or approve bookings.

- `admin` sees everything. They approve every reservation, publish class schedules, manage rooms, and resolve facility reports.
- `faculty` get **My Class Schedule** (their own timetable only), **My Reservations** (their own submissions, with cancel and follow-up), **Laboratory Reservation** to create requests, and **Report an Issue** for broken units and equipment.
- `student` accounts register freely (and choose their section), and can view the Class Schedule, Laboratory Schedule, University Calendar, and **Report an Issue**.
- `faculty`, `admin`, and `mis_staff` must enter a user account code generated from **User Account Codes**.
- Legacy `teacher` accounts are treated as `faculty` by the application.

### Shared Permissions

Page and capability access lives in `shared/permissions.json`. Both the React router and the Express middleware read the same file so the UI and API cannot drift apart.

### Database Migrations

Run from `backend/`:

```bash
node migrations/run.js 001_add_roles.sql
node migrations/run.js 002_schedules.sql
node migrations/run.js 003_convert_teacher_role.sql
node migrations/run.js 004_hardening.sql
node migrations/run.js 005_class_cancellations.sql
node migrations/run.js 006_reservation_purposes.sql
# Only after the backend that reads reservation_purposes is deployed:
node migrations/run.js 007_drop_legacy_purpose.sql
node migrations/run.js 008_facility_reports.sql
node migrations/run.js 009_room_types.sql
node migrations/run.js 010_facility_report_attachments.sql
node migrations/run.js 011_sections.sql
node migrations/run.js 012_password_resets.sql
```

`006_reservation_purposes.sql` is the normalization step for reservation
purposes: it creates the lookup table, backfills existing text, and leaves the
legacy column in place so the previous backend can still run during the deploy.
`007_drop_legacy_purpose.sql` removes that duplicate column once the new backend
is live. The design rationale is in `docs/DATABASE_NORMALIZATION.md`.

Page naming and navigation rules are in `docs/UI_TERMINOLOGY.md`.

`004_hardening.sql` adds the persistent `session` table, consistent id types, reservation overlap protection, room references for schedules, and missing indexes.

### Demo Data

From `backend/`:

```bash
npm run seed:demo
```

This creates a `2026-2027 1st Semester`, sample class entries using existing laboratories, and university calendar events. It is idempotent.

## Architecture

- **Frontend:** React 19 + Vite + React Router. Routes are lazy-loaded per page.
- **API:** Express 5 with same-origin `/api` calls.
- **Sessions:** `express-session` backed by the Postgres `session` table, so logins survive backend restarts.
- **Database:** PostgreSQL on Supabase. Reservations use a GiST exclusion constraint to prevent double-booking at the database level.
- **Deployment:** Vercel rewrites `/api/*` to the Render backend, making cookies first-party and removing the old cross-site cookie dependency.

## Tech Stack
- Frontend: React.js, Vite, Recharts, React Big Calendar, React Router
- Backend: Node.js, Express.js, Express-Session, Zod, Helmet, express-rate-limit
- Database: PostgreSQL (Hosted on Supabase)
- Deployment: Vercel (Frontend), Render (Backend)

## Local Development Setup

### 1. Database Setup (Supabase)

Ensure you have a PostgreSQL database running and apply the migrations in `backend/migrations/`.

### 2. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

Set `DATABASE_URL` in `backend/.env`, then run:

```bash
npm start
```

Use `NODE_ENV=development` locally so the session cookie works over plain HTTP.

### 3. Frontend Setup

From the project root:

```bash
npm install
npm run dev
```

Vite proxies `/api` to `http://localhost:3000`, so no `VITE_API_URL` is needed. The dev server defaults to port 5173; use `npm run dev -- --port 4000` if another project is already using 5173.

## Deployment Notes

- **Backend (Render):** Set `DATABASE_URL`, `SESSION_SECRET`, and `NODE_ENV=production`. The server refuses to start in production without `SESSION_SECRET`.
- **Frontend (Vercel):** `vercel.json` rewrites `/api/*` to `https://room-management-475x.onrender.com/api/*`. If the Render URL changes, update `vercel.json`.
- **Cookies:** Same-origin through the Vercel rewrite, `sameSite: "lax"` and `secure: true` in production.
- **CORS:** Optional `ALLOWED_ORIGINS` can list exact origins for direct API access. The same-origin rewrite does not depend on CORS.
- **Password reset links:** set `APP_URL` to the public frontend URL (e.g. `https://room-management-alpha.vercel.app`) so links generated by the API point at the right host. No mail service is wired up yet: in development the link is printed in the API log, and in production an admin copies it from User Management.
- **Health check:** `GET /api/health`.

## CI

`.github/workflows/ci.yml` installs both packages, runs ESLint, builds the frontend, and syntax-checks the backend.

---

*Completed as a freelance engagement.*
