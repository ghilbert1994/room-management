const express = require("express")
const bcrypt = require("bcrypt")
const crypto = require("crypto")
const db = require("../db.js")
const permissions = require("../../shared/permissions.json")
const { requireAuth, requireCapability, normalizeRole } = require("../middleware/auth.js")
const { logActivity } = require("../lib/activityLog.js")

const router = express.Router()

const adminOnly = [requireAuth, requireCapability("userManage")]

router.get("/users", adminOnly, async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT users.id,
                   users.name,
                   users.email,
                   users.role::text AS role,
                   users.is_active,
                   users.created_at,
                   users.section_id,
                   sections.course || ' ' || sections.year_level || ' ' || sections.name AS section_label
            FROM users
            LEFT JOIN sections ON sections.id = users.section_id
            ORDER BY users.id ASC
        `)

        res.json({ users: rows.map((user) => ({ ...user, role: normalizeRole(user.role) })) })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Failed to load users" })
    }
})

router.put("/users/:id/role", adminOnly, async (req, res) => {
    const role = normalizeRole(req.body.role)

    if (!permissions.roles.includes(role)) {
        return res.status(400).json({ message: "Invalid role" })
    }

    if (String(req.params.id) === String(req.user.id) && role !== "admin") {
        return res.status(400).json({ message: "You cannot remove your own admin role" })
    }

    try {
        const target = await db.query(
            "SELECT id, role::text AS role FROM users WHERE id = $1",
            [req.params.id]
        )

        if (target.rows.length === 0) {
            return res.status(404).json({ message: "User not found" })
        }

        if (normalizeRole(target.rows[0].role) === "admin" && role !== "admin") {
            const admins = await db.query("SELECT count(*)::int AS count FROM users WHERE role = 'admin' AND is_active = true")
            if (admins.rows[0].count <= 1) {
                return res.status(400).json({ message: "At least one active admin is required" })
            }
        }

        const { rows } = await db.query(
            `UPDATE users SET role = $1, updated_at = now()
             WHERE id = $2
             RETURNING id, name, email, role::text AS role, is_active`,
            [role, req.params.id]
        )

        await logActivity({
            req,
            action: "user.role",
            entityType: "user",
            entityId: req.params.id,
            description: `Changed role for ${rows[0].email} to ${role}`,
            metadata: { role }
        })

        res.json({ user: { ...rows[0], role: normalizeRole(rows[0].role) } })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Failed to update the user role" })
    }
})

router.put("/users/:id/active", adminOnly, async (req, res) => {
    const isActive = Boolean(req.body.is_active)

    if (String(req.params.id) === String(req.user.id) && !isActive) {
        return res.status(400).json({ message: "You cannot deactivate your own account" })
    }

    try {
        const { rows } = await db.query(
            `UPDATE users SET is_active = $1, updated_at = now()
             WHERE id = $2
             RETURNING id, name, email, role::text AS role, is_active`,
            [isActive, req.params.id]
        )

        if (rows.length === 0) return res.status(404).json({ message: "User not found" })

        await logActivity({
            req,
            action: "user.status",
            entityType: "user",
            entityId: req.params.id,
            description: `${isActive ? "Activated" : "Deactivated"} account ${rows[0].email}`,
            metadata: { is_active: isActive }
        })

        res.json({ user: { ...rows[0], role: normalizeRole(rows[0].role) } })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Failed to update the account status" })
    }
})

router.post("/users/:id/reset-password", adminOnly, async (req, res) => {
    const suppliedPassword = req.body?.password
    const temporaryPassword = suppliedPassword || `LCUP-${crypto.randomBytes(4).toString("hex")}`

    if (String(temporaryPassword).length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" })
    }

    try {
        const hash = await bcrypt.hash(temporaryPassword, 10)
        const { rows } = await db.query(
            `UPDATE users SET password = $1, updated_at = now()
             WHERE id = $2
             RETURNING id, name, email`,
            [hash, req.params.id]
        )

        if (rows.length === 0) return res.status(404).json({ message: "User not found" })

        await logActivity({
            req,
            action: "user.reset_password",
            entityType: "user",
            entityId: req.params.id,
            description: `Issued a temporary password for ${rows[0].email}`
        })

        res.json({
            message: "Password reset",
            temporaryPassword: suppliedPassword ? undefined : temporaryPassword,
            user: rows[0]
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Failed to reset the password" })
    }
})

router.put("/users/:id/section", adminOnly, async (req, res) => {
    const requested = Number(req.body.sectionId)
    const sectionId = Number.isInteger(requested) && requested > 0 ? requested : null

    try {
        const target = await db.query("SELECT id, role::text AS role FROM users WHERE id = $1", [req.params.id])
        if (target.rows.length === 0) return res.status(404).json({ message: "User not found" })
        if (normalizeRole(target.rows[0].role) !== "student") {
            return res.status(400).json({ message: "Only student accounts belong to a section" })
        }

        if (sectionId) {
            const section = await db.query("SELECT id FROM sections WHERE id = $1 AND is_active", [sectionId])
            if (section.rows.length === 0) return res.status(400).json({ message: "That section was not found" })
        }

        const { rows } = await db.query(
            `UPDATE users
             SET section_id = $1, updated_at = now()
             WHERE id = $2
             RETURNING id, name, email, role::text AS role, is_active, section_id,
                 (SELECT course || ' ' || year_level || ' ' || name FROM sections WHERE sections.id = users.section_id) AS section_label`,
            [sectionId, req.params.id]
        )

        await logActivity({
            req,
            action: "user.section",
            entityType: "user",
            entityId: req.params.id,
            description: `Set section for ${rows[0].email} to ${rows[0].section_label || "none"}`,
            metadata: { section_id: sectionId }
        })

        res.json({ user: { ...rows[0], role: normalizeRole(rows[0].role) } })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Failed to update the user section" })
    }
})

router.get("/activity-logs", adminOnly, async (req, res) => {
    const { q, action, entity, from, to } = req.query
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200)
    const page = Math.max(Number(req.query.page) || 1, 1)
    const offset = (page - 1) * limit

    const conditions = []
    const values = []

    if (q) {
        values.push(`%${String(q).trim()}%`)
        const index = values.length
        conditions.push(`(description ILIKE $${index} OR actor_name ILIKE $${index} OR actor_email ILIKE $${index} OR action ILIKE $${index})`)
    }
    if (action) {
        values.push(String(action))
        conditions.push(`action = $${values.length}`)
    }
    if (entity) {
        values.push(String(entity))
        conditions.push(`entity_type = $${values.length}`)
    }
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
        values.push(from)
        conditions.push(`created_at >= $${values.length}::date`)
    }
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
        values.push(to)
        conditions.push(`created_at < ($${values.length}::date + interval '1 day')`)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

    try {
        const [countResult, logsResult, actionsResult, entitiesResult] = await Promise.all([
            db.query(`SELECT count(*)::int AS total FROM activity_logs ${where}`, values),
            db.query(
                `SELECT id, user_id, actor_name, actor_email, actor_role, action, entity_type, entity_id,
                        description, metadata, ip_address, created_at
                 FROM activity_logs
                 ${where}
                 ORDER BY created_at DESC
                 LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
                [...values, limit, offset]
            ),
            db.query("SELECT DISTINCT action FROM activity_logs ORDER BY action"),
            db.query("SELECT DISTINCT entity_type FROM activity_logs WHERE entity_type IS NOT NULL ORDER BY entity_type")
        ])

        res.json({
            logs: logsResult.rows,
            total: countResult.rows[0].total,
            page,
            limit,
            actions: actionsResult.rows.map((row) => row.action),
            entities: entitiesResult.rows.map((row) => row.entity_type)
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Failed to load the activity log" })
    }
})

router.get("/password-resets", adminOnly, async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT password_resets.id,
                   password_resets.created_at,
                   password_resets.expires_at,
                   users.id AS user_id,
                   users.name,
                   users.email
            FROM password_resets
            JOIN users ON users.id = password_resets.user_id
            WHERE password_resets.used_at IS NULL
              AND password_resets.expires_at > now()
            ORDER BY password_resets.created_at DESC
        `)

        res.json({ requests: rows })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Failed to load password reset requests" })
    }
})

router.post("/password-resets/:id/link", adminOnly, async (req, res) => {
    const token = crypto.randomBytes(32).toString("hex")
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

    try {
        const { rows } = await db.query(`
            UPDATE password_resets
            SET token_hash = $1, expires_at = now() + interval '60 minutes'
            WHERE id = $2 AND used_at IS NULL
            RETURNING id
        `, [tokenHash, req.params.id])

        if (rows.length === 0) return res.status(404).json({ message: "Reset request not found or already used" })

        res.json({ url: `/reset-password?token=${token}` })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Failed to create a reset link" })
    }
})

router.delete("/password-resets/:id", adminOnly, async (req, res) => {
    try {
        const { rowCount } = await db.query(
            "UPDATE password_resets SET used_at = now() WHERE id = $1 AND used_at IS NULL",
            [req.params.id]
        )
        if (rowCount === 0) return res.status(404).json({ message: "Reset request not found" })
        res.json({ message: "Reset request dismissed" })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Failed to dismiss the reset request" })
    }
})

module.exports = router
