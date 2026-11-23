const db = require("../db.js")

// Inserts one notification row per active user with the given roles.
// Each user gets their own row so the existing bell, unread count, and
// mark-as-read flow keep working without changes.
async function notifyRoles(roles, message, client = db) {
    const targets = (roles || []).filter(Boolean)
    const text = String(message || "").trim()

    if (targets.length === 0 || !text) return 0

    const { rowCount } = await client.query(
        `INSERT INTO notifications (user_id, message)
         SELECT id, $1
         FROM users
         WHERE role = ANY($2::user_role[])
           AND is_active = true`,
        [text, targets]
    )

    return rowCount
}

const NOTIFY_STUDENTS = ["student"]

module.exports = { notifyRoles, NOTIFY_STUDENTS }
