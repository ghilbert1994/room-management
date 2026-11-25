const express = require("express")
const router = express.Router()
const db = require("../db.js")
const { requireAuth, requireCapability } = require("../middleware/auth.js")
const { notifyRoles, NOTIFY_STUDENTS } = require("../lib/facilityNotify.js")

const canReport = requireCapability("facilityReport")
const canManage = requireCapability("facilityManage")

const STAFF_ROLES = ["admin", "mis_staff"]
const isStaff = (role) => STAFF_ROLES.includes(role)

const MAX_ATTACHMENTS = 3
const MAX_FILE_BYTES = 4 * 1024 * 1024
const MAX_TOTAL_BYTES = 10 * 1024 * 1024
const ALLOWED_PREFIXES = ["image/", "video/"]

const decodeAttachment = (item) => {
    const name = String(item?.name || "attachment").slice(0, 200)
    const type = String(item?.type || "")

    if (!ALLOWED_PREFIXES.some((prefix) => type.startsWith(prefix))) {
        return { error: "Only photos and videos can be attached" }
    }

    const base64 = String(item?.data || "").replace(/^data:[^;]+;base64,/, "")
    if (!base64) return { error: `${name} is empty` }

    const buffer = Buffer.from(base64, "base64")
    if (buffer.length === 0) return { error: `${name} is empty` }
    if (buffer.length > MAX_FILE_BYTES) return { error: `${name} is larger than 4 MB` }

    return { name, type, buffer }
}

const reportTarget = (report) =>
    report.computer_id
        ? `Unit ${report.pc_number} in ${report.room_name}`
        : report.room_name

// Rooms and computers the reporter can pick from.
router.get("/report-options", requireAuth, async (req, res) => {
    try {
        const rooms = await db.query("SELECT id, name, location FROM rooms ORDER BY name ASC")
        const computers = await db.query(`
            SELECT computers.id,
                   computers.pc_number,
                   computers.room_id,
                   computers.is_maintenance,
                   rooms.name AS room_name
            FROM computers
            JOIN rooms ON rooms.id = computers.room_id
            ORDER BY rooms.name ASC, computers.pc_number ASC
        `)
        const sections = await db.query(`
            SELECT id, course, year_level, name,
                   course || ' ' || year_level || ' ' || name AS label
            FROM sections
            WHERE is_active
            ORDER BY course ASC, year_level ASC, name ASC
        `)

        res.json({ rooms: rooms.rows, computers: computers.rows, sections: sections.rows })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Failed to load report options" })
    }
})

// Faculty, students, and staff submit a facility report.
router.post("/reports", requireAuth, canReport, async (req, res) => {
    const { roomId, computerId, description, sectionId } = req.body
    const text = String(description || "").trim()
    const rawAttachments = Array.isArray(req.body.attachments) ? req.body.attachments : []

    if (!roomId && !computerId) {
        return res.status(400).json({ error: "Choose a room or a unit to report" })
    }
    if (text.length < 3 || text.length > 500) {
        return res.status(400).json({ error: "Describe the problem in 3 to 500 characters" })
    }
    if (rawAttachments.length > MAX_ATTACHMENTS) {
        return res.status(400).json({ error: `Attach at most ${MAX_ATTACHMENTS} files` })
    }

    let section = null
    if (sectionId) {
        const sectionRows = await db.query(
            "SELECT id, course, year_level, name FROM sections WHERE id = $1 AND is_active",
            [sectionId]
        )
        if (sectionRows.rows.length === 0) {
            return res.status(400).json({ error: "That section was not found" })
        }
        section = sectionRows.rows[0]
        section.label = `${section.course} ${section.year_level} ${section.name}`
    }

    if (!section && !isStaff(req.user.role)) {
        return res.status(400).json({ error: "Choose the section that was scheduled" })
    }

    const attachments = []
    let totalBytes = 0

    for (const item of rawAttachments) {
        const decoded = decodeAttachment(item)
        if (decoded.error) return res.status(400).json({ error: decoded.error })
        totalBytes += decoded.buffer.length
        if (totalBytes > MAX_TOTAL_BYTES) {
            return res.status(400).json({ error: "Attachments are larger than the 10 MB limit" })
        }
        attachments.push(decoded)
    }

    const client = await db.connect()

    try {
        await client.query("BEGIN")

        let target = null

        if (computerId) {
            const { rows } = await client.query(`
                SELECT computers.id, computers.pc_number, computers.room_id, rooms.name AS room_name
                FROM computers
                JOIN rooms ON rooms.id = computers.room_id
                WHERE computers.id = $1
            `, [computerId])

            if (rows.length === 0) {
                await client.query("ROLLBACK")
                return res.status(404).json({ error: "Unit not found" })
            }
            target = rows[0]
        } else {
            const { rows } = await client.query("SELECT id, name FROM rooms WHERE id = $1", [roomId])
            if (rows.length === 0) {
                await client.query("ROLLBACK")
                return res.status(404).json({ error: "Laboratory not found" })
            }
            target = rows[0]
        }

        const computerIdValue = target.pc_number ? target.id : null
        const roomIdValue = target.room_id || target.id
        const label = target.pc_number ? `Unit ${target.pc_number} in ${target.room_name}` : target.name

        const { rows } = await client.query(`
            INSERT INTO facility_reports (reported_by, room_id, computer_id, description, section_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, room_id, computer_id, description, status, created_at, section_id
        `, [req.user.id, roomIdValue, computerIdValue, text, section?.id || null])

        const reportId = rows[0].id

        for (const attachment of attachments) {
            await client.query(`
                INSERT INTO facility_report_attachments (report_id, file_name, mime_type, size_bytes, data)
                VALUES ($1, $2, $3, $4, $5)
            `, [reportId, attachment.name, attachment.type, attachment.buffer.length, attachment.buffer])
        }

        await client.query("COMMIT")

        const reporter = req.user.name || req.user.email
        const evidence = attachments.length > 0 ? ` (${attachments.length} file${attachments.length === 1 ? "" : "s"} attached)` : ""
        const sectionText = section ? ` [Section ${section.label}]` : ""

        await notifyRoles(
            STAFF_ROLES,
            `New facility report: ${label}${sectionText} — ${text}${evidence} (reported by ${reporter}).`
        )

        res.status(201).json({ message: "Report submitted", report: { ...rows[0], section: section?.label || null, attachments: attachments.length } })
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {})
        console.error(error)
        res.status(500).json({ error: "Failed to submit report" })
    } finally {
        client.release()
    }
})

// Staff see every report; faculty see only their own.
router.get("/reports", requireAuth, canReport, async (req, res) => {
    try {
        const ownOnly = !isStaff(req.user.role)

        const { rows } = await db.query(`
            SELECT facility_reports.id,
                   facility_reports.description,
                   facility_reports.status,
                   facility_reports.resolution_note,
                   facility_reports.created_at,
                   facility_reports.resolved_at,
                   facility_reports.computer_id,
                   facility_reports.room_id,
                   rooms.name AS room_name,
                   computers.pc_number,
                   facility_reports.section_id,
                   sections.course || ' ' || sections.year_level || ' ' || sections.name AS section_label,
                   reporter.name AS reporter_name,
                   reporter.email AS reporter_email,
                   COALESCE(attachments.items, '[]'::json) AS attachments
            FROM facility_reports
            JOIN rooms ON rooms.id = facility_reports.room_id
            LEFT JOIN computers ON computers.id = facility_reports.computer_id
            LEFT JOIN sections ON sections.id = facility_reports.section_id
            JOIN users AS reporter ON reporter.id = facility_reports.reported_by
            LEFT JOIN LATERAL (
                SELECT json_agg(
                           json_build_object(
                               'id', facility_report_attachments.id,
                               'name', facility_report_attachments.file_name,
                               'type', facility_report_attachments.mime_type,
                               'size', facility_report_attachments.size_bytes
                           )
                           ORDER BY facility_report_attachments.id
                       ) AS items
                FROM facility_report_attachments
                WHERE facility_report_attachments.report_id = facility_reports.id
            ) AS attachments ON true
            ${ownOnly ? "WHERE facility_reports.reported_by = $1" : ""}
            ORDER BY CASE facility_reports.status WHEN 'open' THEN 0 ELSE 1 END,
                     facility_reports.created_at DESC
            LIMIT 100
        `, ownOnly ? [req.user.id] : [])

        res.json({ reports: rows })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Failed to load reports" })
    }
})

// Staff resolve a report: apply maintenance, clear maintenance, or dismiss.
router.put("/reports/:id/resolve", requireAuth, canManage, async (req, res) => {
    const { action, note } = req.body
    const { id } = req.params

    if (!["apply", "clear", "dismiss"].includes(action)) {
        return res.status(400).json({ error: "Choose apply, clear, or dismiss" })
    }

    try {
        const { rows } = await db.query(`
            SELECT facility_reports.*,
                   rooms.name AS room_name,
                   computers.pc_number
            FROM facility_reports
            JOIN rooms ON rooms.id = facility_reports.room_id
            LEFT JOIN computers ON computers.id = facility_reports.computer_id
            WHERE facility_reports.id = $1
        `, [id])

        if (rows.length === 0) return res.status(404).json({ error: "Report not found" })

        const report = rows[0]
        if (report.status !== "open") return res.status(409).json({ error: "This report is already closed" })

        const label = reportTarget(report)
        let studentMessage = null

        if (action === "apply" || action === "clear") {
            if (report.computer_id) {
                const current = await db.query("SELECT is_maintenance FROM computers WHERE id = $1", [report.computer_id])
                const wasUnderMaintenance = current.rows[0]?.is_maintenance === true
                const next = action === "apply"

                if (wasUnderMaintenance !== next) {
                    await db.query(
                        "UPDATE computers SET is_maintenance = $1, maintenance_reason = $2 WHERE id = $3",
                        [next, next ? report.description : null, report.computer_id]
                    )
                    studentMessage = next
                        ? `Facility notice: ${label} is out of service (${report.description}).`
                        : `Facility notice: ${label} is back in service.`
                }
            } else {
                const current = await db.query("SELECT maintenance FROM rooms WHERE id = $1", [report.room_id])
                const wasUnderMaintenance = current.rows[0]?.maintenance === true
                const next = action === "apply"

                if (wasUnderMaintenance !== next) {
                    await db.query(
                        `UPDATE rooms
                         SET maintenance = $1, maintenance_reason = $2, maintenance_until = NULL
                         WHERE id = $3`,
                        [next, next ? report.description : null, report.room_id]
                    )
                    studentMessage = next
                        ? `Facility notice: ${label} is under maintenance (${report.description}).`
                        : `Facility notice: ${label} is available again.`
                }
            }
        }

        const nextStatus = action === "dismiss" ? "dismissed" : "resolved"

        await db.query(`
            UPDATE facility_reports
            SET status = $1, resolution_note = $2, resolved_by = $3, resolved_at = now()
            WHERE id = $4
        `, [nextStatus, String(note || "").trim() || null, req.user.id, id])

        if (studentMessage) {
            await notifyRoles(NOTIFY_STUDENTS, studentMessage)
        }

        await db.query(
            "INSERT INTO notifications (user_id, message) VALUES ($1, $2)",
            [report.reported_by, `Your facility report about ${label} was ${nextStatus}.`]
        )

        res.json({
            message: `Report ${nextStatus}`,
            status: nextStatus,
            studentsNotified: studentMessage ? true : false
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Failed to resolve report" })
    }
})

// Evidence attached to a report. Visible to staff and to the reporter.
router.get("/attachments/:id", requireAuth, async (req, res) => {
    const { id } = req.params

    try {
        const { rows } = await db.query(`
            SELECT attachments.id,
                   attachments.file_name,
                   attachments.mime_type,
                   attachments.size_bytes,
                   attachments.data,
                   reports.reported_by
            FROM facility_report_attachments AS attachments
            JOIN facility_reports AS reports ON reports.id = attachments.report_id
            WHERE attachments.id = $1
        `, [id])

        if (rows.length === 0) return res.status(404).json({ error: "Attachment not found" })

        const file = rows[0]
        if (!isStaff(req.user.role) && String(file.reported_by) !== String(req.user.id)) {
            return res.status(403).json({ error: "You cannot view this attachment" })
        }

        res.setHeader("Content-Type", file.mime_type)
        res.setHeader("Content-Length", file.size_bytes)
        res.setHeader("Content-Disposition", `inline; filename="${String(file.file_name).replace(/"/g, "")}"`)
        res.send(file.data)
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Failed to load attachment" })
    }
})

module.exports = router
