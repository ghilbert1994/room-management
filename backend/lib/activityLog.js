const db = require("../db.js")

const clientIp = (req) => {
    if (!req) return null
    const forwarded = req.headers?.["x-forwarded-for"]
    if (forwarded) return String(forwarded).split(",")[0].trim().slice(0, 100)
    return req.ip ? String(req.ip).slice(0, 100) : null
}

// Append-only audit entry. Failures are swallowed so logging can never break
// the request it is describing.
async function logActivity({
    req = null,
    actor = null,
    action,
    entityType = null,
    entityId = null,
    description,
    metadata = {},
    client = db
}) {
    try {
        const user = actor || req?.user || null

        await client.query(`
            INSERT INTO activity_logs
                (user_id, actor_name, actor_email, actor_role, action,
                 entity_type, entity_id, description, metadata, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
            user?.id || null,
            user?.name || null,
            user?.email || null,
            user?.role || null,
            action,
            entityType,
            entityId ? String(entityId) : null,
            String(description || action),
            JSON.stringify(metadata || {}),
            clientIp(req),
            req?.headers?.["user-agent"] ? String(req.headers["user-agent"]).slice(0, 300) : null
        ])
    } catch (error) {
        console.error("Failed to write activity log:", error.message)
    }
}

module.exports = { logActivity }
