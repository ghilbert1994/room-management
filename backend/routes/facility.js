const express = require("express")
const router = express.Router()
const db = require("../db.js")
const { requireAuth, requireCapability } = require("../middleware/auth.js")
const { notifyRoles, NOTIFY_STUDENTS } = require("../lib/facilityNotify.js")

const canReport = requireCapability("facilityReport")
const canManage = requireCapability("facilityManage")

const STAFF_ROLES = ["admin", "mis_staff"]
const isStaff = (role) => STAFF_ROLES.includes(role)

const reportTarget = (report) =>
    report.computer_id
        ? `PC ${report.pc_number} in ${report.room_name}`
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

        res.json({ rooms: rooms.rows, computers: computers.rows })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Failed to load report options" })
    }
})

// Faculty (and staff) submit a facility report.
router.post("/reports", requireAuth, canReport, async (req, res) => {
    const { roomId, computerId, description } = req.body
    const text = String(description || "").trim()

    if (!roomId && !computerId) {
        return res.status(400).json({ error: "Choose a room or a computer to report" })
    }
    if (text.length < 3 || text.length > 500) {
        return res.status(400).json({ error: "Describe the problem in 3 to 500 characters" })
    }

    try {
        let target = null

        if (computerId) {
            const { rows } = await db.query(`
                SELECT computers.id, computers.pc_number, computers.room_id, rooms.name AS room_name
                FROM computers
                JOIN rooms ON rooms.id = computers.room_id
                WHERE computers.id = $1
            `, [computerId])

            if (rows.length === 0) return res.status(404).json({ error: "Computer not found" })
            target = rows[0]
        } else {
            const { rows } = await db.query("SELECT id, name FROM rooms WHERE id = $1", [roomId])
            if (rows.length === 0) return res.status(404).json({ error: "Laboratory not found" })
            target = rows[0]
        }

        const computerIdValue = target.pc_number ? target.id : null
        const roomIdValue = target.room_id || target.id
        const label = target.pc_number ? `PC ${target.pc_number} in ${target.room_name}` : target.name

        const { rows } = await db.query(`
            INSERT INTO facility_reports (reported_by, room_id, computer_id, description)
            VALUES ($1, $2, $3, $4)
            RETURNING id, room_id, computer_id, description, status, created_at
        `, [req.user.id, roomIdValue, computerIdValue, text])

        const reporter = req.user.name || req.user.email
        await notifyRoles(
            STAFF_ROLES,
            `New facility report: ${label} — ${text} (reported by ${reporter}).`
        )

        res.status(201).json({ message: "Report submitted", report: rows[0] })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Failed to submit report" })
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
                   reporter.name AS reporter_name,
                   reporter.email AS reporter_email
            FROM facility_reports
            JOIN rooms ON rooms.id = facility_reports.room_id
            LEFT JOIN computers ON computers.id = facility_reports.computer_id
            JOIN users AS reporter ON reporter.id = facility_reports.reported_by
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

module.exports = router
