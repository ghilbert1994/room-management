const path = require("path")
const { Client } = require("pg")

require("dotenv").config({ path: path.join(__dirname, "..", ".env") })

const force = process.argv.includes("--force")

const ROWS = [
    { hours: 2, email: "admin@example.com", action: "login", entity: "auth", description: "signed in" },
    { hours: 3, email: "teacher@gmail.com", action: "login", entity: "auth", description: "signed in" },
    { hours: 4, email: "student@gmail.com", action: "login", entity: "auth", description: "signed in" },
    { hours: 5, email: "teacher@gmail.com", action: "reservation.create", entity: "reservation", description: "requested MR 209 for a class activity (BSIT 1st Year A)" },
    { hours: 5, email: "admin@example.com", action: "reservation.status", entity: "reservation", description: "approved the MR 209 reservation" },
    { hours: 6, email: "student@gmail.com", action: "report.create", entity: "facility_report", description: "reported Unit 12 in MR 204 (BSIT 1st Year A): monitor not working" },
    { hours: 6, email: "mis@example.com", action: "report.resolve", entity: "facility_report", description: "flagged Unit 12 in MR 204 for maintenance" },
    { hours: 8, email: "admin@example.com", action: "room.maintenance", entity: "room", description: "put MR 204 under maintenance (full room repair)" },
    { hours: 9, email: "mis@example.com", action: "unit.maintenance", entity: "computer", description: "flagged Unit 12 in MR 204 as out of service (broken monitor)" },
    { hours: 26, email: "admin@example.com", action: "schedule.create", entity: "schedule", description: "added Introduction to Computing (BSIT 1st Year A) to MR 209" },
    { hours: 27, email: "admin@example.com", action: "schedule.import", entity: "schedule", description: "imported 12 class schedule entries" },
    { hours: 28, email: "admin@example.com", action: "user.role", entity: "user", description: "changed the role for teacher2@gmail.com to Faculty" },
    { hours: 30, email: "admin@example.com", action: "user.section", entity: "user", description: "set the section for student@gmail.com to BSIT 1st Year A" },
    { hours: 32, email: "admin@example.com", action: "invite.create", entity: "invite_code", description: "created a Faculty user account code (New faculty batch)" },
    { hours: 33, email: "unknown@example.com", action: "login_failed", entity: "auth", description: "failed sign-in attempt", noUser: true },
    { hours: 34, email: "student@gmail.com", action: "logout", entity: "auth", description: "signed out" },
    { hours: 50, email: "teacher@gmail.com", action: "reservation.cancel", entity: "reservation", description: "cancelled a reservation for MR 210 (class moved online)" },
    { hours: 52, email: "admin@example.com", action: "room.create", entity: "room", description: "created classroom SA 305 (Saint Albert Building)" },
    { hours: 53, email: "admin@example.com", action: "room.update", entity: "room", description: "updated room MR 209 capacity to 45" },
    { hours: 70, email: "admin@example.com", action: "event.create", entity: "event", description: "added calendar event \"Foundation Day\"" },
    { hours: 72, email: "admin@example.com", action: "semester.create", entity: "semester", description: "created semester 2026-2027 2nd Semester" },
    { hours: 74, email: "teacher@gmail.com", action: "password_reset_requested", entity: "user", description: "requested a password reset" },
    { hours: 76, email: "admin@example.com", action: "user.reset_password", entity: "user", description: "issued a temporary password for teacher2@gmail.com" },
    { hours: 90, email: "teacher@gmail.com", action: "reservation.follow_up", entity: "reservation", description: "sent a follow-up about the MR 209 reservation" },
    { hours: 96, email: "admin@example.com", action: "schedule.cancel_class", entity: "schedule", description: "cancelled one class date for Introduction to Computing" },
    { hours: 100, email: "admin@example.com", action: "user.status", entity: "user", description: "deactivated account trial.student@example.com" },
    { hours: 120, email: "admin@example.com", action: "login", entity: "auth", description: "signed in" },
    { hours: 130, email: "teacher@gmail.com", action: "report.create", entity: "facility_report", description: "reported PC 4 in MR 209 (BSIT 2nd Year A): keyboard not working" },
    { hours: 140, email: "admin@example.com", action: "reservation.create", entity: "reservation", description: "reserved SA 304 for an exam (BSIT 4th Year A)" },
    { hours: 150, email: "admin@example.com", action: "room.delete", entity: "room", description: "deleted room QA Lab 1" }
]

;(async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL })

    try {
        await client.connect()

        const existing = await client.query("SELECT count(*)::int AS total FROM activity_logs")
        if (existing.rows[0].total > 0 && !force) {
            console.log(`activity_logs already has ${existing.rows[0].total} row(s). Re-run with --force to add the demo rows anyway.`)
            return
        }

        const users = await client.query("SELECT id, name, email, role::text AS role FROM users")
        const byEmail = new Map(users.rows.map((user) => [user.email, user]))
        const ips = ["127.0.0.1", "192.168.1.25", "10.0.0.14", "172.16.0.8"]

        for (const [index, row] of ROWS.entries()) {
            const user = row.noUser ? null : byEmail.get(row.email) || null

            await client.query(`
                INSERT INTO activity_logs
                    (user_id, actor_name, actor_email, actor_role, action, entity_type, entity_id,
                     description, metadata, ip_address, user_agent, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11,
                        now() - ($12::text || ' hours')::interval)
            `, [
                user?.id || null,
                user?.name || (row.noUser ? null : row.email.split("@")[0]),
                user?.email || row.email,
                user?.role || (row.noUser ? null : "student"),
                row.action,
                row.entity,
                null,
                row.description,
                JSON.stringify({ seeded: true }),
                ips[index % ips.length],
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
                row.hours
            ])
        }

        console.log(`Inserted ${ROWS.length} demo activity log rows.`)
    } catch (error) {
        console.error(error)
        process.exitCode = 1
    } finally {
        await client.end()
    }
})()
