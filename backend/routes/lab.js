const express = require("express")
const router = express.Router()
const db = require("../db.js")
const { requireAuth, requireCapability } = require("../middleware/auth.js")
const { notifyRoles, NOTIFY_STUDENTS } = require("../lib/facilityNotify.js")
const { logActivity } = require("../lib/activityLog.js")

const labWrite = requireCapability("labWrite")

const ROOM_TYPES = ["laboratory", "classroom"]

const toPositiveInt = (value, fallback = 0) => {
    const number = Number(value)
    return Number.isInteger(number) && number >= 0 ? number : fallback
}

const toRoomType = (value) => (ROOM_TYPES.includes(value) ? value : "laboratory")

router.post("/add", requireAuth, labWrite, async (req, res) => {
    const { roomName, roomBuilding, roomCapacity, roomPCS, roomType } = req.body

    if (!String(roomName || "").trim() || !String(roomBuilding || "").trim()) {
        return res.status(400).json({ error: "Room name and building are required" })
    }

    const type = toRoomType(roomType)
    const capacity = toPositiveInt(roomCapacity)
    const computerCount = type === "laboratory" ? toPositiveInt(roomPCS) : 0
    const client = await db.connect()

    try {
        await client.query("BEGIN")

        const { rows } = await client.query(
            `INSERT INTO rooms (name, location, capacity, computer_count, maintenance, room_type)
             VALUES ($1, $2, $3, $4, false, $5)
             RETURNING id`,
            [String(roomName).trim(), String(roomBuilding).trim(), capacity, computerCount, type]
        )

        const roomId = rows[0].id

        if (computerCount > 0) {
            await client.query(
                `INSERT INTO computers (room_id, pc_number, is_maintenance)
                 SELECT $1, gs, false
                 FROM generate_series(1, $2) AS gs`,
                [roomId, computerCount]
            )
        }

        await client.query("COMMIT")

        await logActivity({
            req,
            action: "room.create",
            entityType: "room",
            entityId: roomId,
            description: `Created ${type} ${String(roomName).trim()} (${String(roomBuilding).trim()})`,
            metadata: { roomType: type, capacity, computers: computerCount }
        })

        res.status(201).json({ message: "Lab added successfully", roomId })
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {})
        if (error.code === "23505") {
            return res.status(409).json({ error: "A room with this room name already exists" })
        }
        if (error.code === "23503") {
            return res.status(400).json({ error: "The selected coordinator was not found" })
        }
        console.error(error)
        res.status(500).json({ error: "Failed to add laboratory" })
    } finally {
        client.release()
    }
})

router.get("/all", requireAuth, async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT rooms.*
            FROM rooms
            ORDER BY rooms.name ASC
        `)
        res.json({ labs: rows })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Failed to retrieve laboratories" })
    }
})

router.put("/edit", requireAuth, labWrite, async (req, res) => {
    const { roomName, newRoomName, roomBuilding, roomCapacity, roomPCS, roomType } = req.body

    if (!String(roomName || "").trim() || !String(newRoomName || "").trim()) {
        return res.status(400).json({ error: "Room name is required" })
    }

    const type = toRoomType(roomType)

    try {
        const { rowCount } = await db.query(
            `UPDATE rooms
             SET name = $1, location = $2, capacity = $3, computer_count = $4, room_type = $5
             WHERE name = $6`,
            [
                String(newRoomName).trim(),
                String(roomBuilding || "").trim(),
                toPositiveInt(roomCapacity),
                type === "laboratory" ? toPositiveInt(roomPCS) : 0,
                type,
                roomName
            ]
        )
        if (rowCount === 0) return res.status(404).json({ error: "Laboratory not found" })

        await logActivity({
            req,
            action: "room.update",
            entityType: "room",
            entityId: roomName,
            description: `Updated room ${roomName}${newRoomName !== roomName ? ` → ${newRoomName}` : ""}`,
            metadata: { roomType: type }
        })

        res.json({ message: "Laboratory updated successfully" })
    } catch (error) {
        if (error.code === "23505") return res.status(409).json({ error: "A room with this room name already exists" })
        console.error(error)
        res.status(500).json({ error: "Failed to update laboratory" })
    }
})

router.delete("/delete", requireAuth, labWrite, async (req, res) => {
    const { roomName } = req.body
    try {
        const { rowCount } = await db.query("DELETE FROM rooms WHERE name = $1", [roomName])
        if (rowCount === 0) return res.status(404).json({ error: "Laboratory not found" })

        await logActivity({
            req,
            action: "room.delete",
            entityType: "room",
            entityId: roomName,
            description: `Deleted room ${roomName}`
        })

        res.json({ message: "Laboratory deleted successfully" })
    } catch (error) {
        if (error.code === "23503") {
            return res.status(409).json({ error: "This laboratory still has reservations or schedules attached" })
        }
        console.error(error)
        res.status(500).json({ error: "Failed to delete laboratory" })
    }
})

router.put("/maintenance", requireAuth, labWrite, async (req, res) => {
    const { roomName, maintenance, maintenanceReason, maintenanceUntil } = req.body
    try {
        const reason = maintenance ? maintenanceReason : null
        const until = maintenance && maintenanceUntil ? maintenanceUntil : null
        const nextState = Boolean(maintenance)

        const current = await db.query(
            "SELECT maintenance FROM rooms WHERE name = $1",
            [roomName]
        )
        if (current.rows.length === 0) return res.status(404).json({ error: "Laboratory not found" })

        const wasUnderMaintenance = current.rows[0].maintenance === true

        const { rowCount } = await db.query(
            `UPDATE rooms SET maintenance = $1, maintenance_reason = $2, maintenance_until = $3 WHERE name = $4`,
            [nextState, reason, until, roomName]
        )
        if (rowCount === 0) return res.status(404).json({ error: "Laboratory not found" })

        let notified = 0
        if (nextState !== wasUnderMaintenance) {
            const message = nextState
                ? `Facility notice: ${roomName} is under maintenance${reason ? ` (${reason})` : ""}${until ? `. Expected back on ${String(until).slice(0, 10)}` : ""}.`
                : `Facility notice: ${roomName} is available again.`

            notified = await notifyRoles(NOTIFY_STUDENTS, message)

            await logActivity({
                req,
                action: "room.maintenance",
                entityType: "room",
                entityId: roomName,
                description: nextState
                    ? `Put ${roomName} under maintenance${reason ? ` (${reason})` : ""}`
                    : `Cleared maintenance for ${roomName}`,
                metadata: { maintenance: nextState, reason }
            })
        }

        res.json({ message: "Maintenance status updated successfully", notified })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Failed to update maintenance status" })
    }
})

router.get("/issues", requireAuth, labWrite, async (req, res) => {
    try {
        const rooms = await db.query(`
            SELECT id, name, location, maintenance_reason, maintenance_until
            FROM rooms
            WHERE maintenance = true
            ORDER BY name ASC
        `)
        const computers = await db.query(`
            SELECT computers.id,
                   computers.pc_number,
                   computers.maintenance_reason,
                   computers.room_id,
                   rooms.name AS room_name
            FROM computers
            JOIN rooms ON rooms.id = computers.room_id
            WHERE computers.is_maintenance = true
            ORDER BY rooms.name ASC, computers.pc_number ASC
        `)

        res.json({ rooms: rooms.rows, computers: computers.rows })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Failed to retrieve facility issues" })
    }
})

// Re-send a reminder for an issue that is still open.
router.post("/issues/notify", requireAuth, labWrite, async (req, res) => {
    const { type, id } = req.body
    if (!["room", "computer"].includes(type) || !id) {
        return res.status(400).json({ error: "Issue type and id are required" })
    }

    try {
        let message = null

        if (type === "room") {
            const { rows } = await db.query(
                "SELECT name, maintenance, maintenance_reason FROM rooms WHERE id = $1",
                [id]
            )
            if (rows.length === 0) return res.status(404).json({ error: "Laboratory not found" })
            if (!rows[0].maintenance) return res.status(409).json({ error: "This laboratory is not under maintenance" })

            message = `Reminder: ${rows[0].name} is still under maintenance${rows[0].maintenance_reason ? ` (${rows[0].maintenance_reason})` : ""}.`
        } else {
            const { rows } = await db.query(`
                SELECT computers.pc_number, computers.is_maintenance, computers.maintenance_reason, rooms.name AS room_name
                FROM computers
                JOIN rooms ON rooms.id = computers.room_id
                WHERE computers.id = $1
            `, [id])
            if (rows.length === 0) return res.status(404).json({ error: "Computer not found" })
            if (!rows[0].is_maintenance) return res.status(409).json({ error: "This computer is not out of service" })

            message = `Reminder: Unit ${rows[0].pc_number} in ${rows[0].room_name} is still out of service${rows[0].maintenance_reason ? ` (${rows[0].maintenance_reason})` : ""}.`
        }

        const notified = await notifyRoles(NOTIFY_STUDENTS, message)
        res.json({ message: "Reminder sent", notified })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Failed to send reminder" })
    }
})

router.get("/get-computers", requireAuth, labWrite, async (req, res) => {
    const { roomId } = req.query

    try {
        const { rows } = await db.query(
            "SELECT * FROM computers WHERE room_id = $1 ORDER BY pc_number ASC",
            [roomId]
        )
        res.json({ computers: rows })
    } catch (error) {
        if (error.code === "22P02") return res.status(400).json({ error: "Invalid room id" })
        console.error(error)
        res.status(500).json({ error: "Failed to retrieve computers" })
    }
})

router.put("/toggle-pc", requireAuth, labWrite, async (req, res) => {
    const { computerId, isMaintenance, maintenanceReason } = req.body
    try {
        const { rows } = await db.query(`
            SELECT computers.id,
                   computers.pc_number,
                   computers.is_maintenance,
                   rooms.name AS room_name
            FROM computers
            JOIN rooms ON rooms.id = computers.room_id
            WHERE computers.id = $1
        `, [computerId])

        if (rows.length === 0) return res.status(404).json({ error: "Computer not found" })

        const computer = rows[0]
        const nextState = Boolean(isMaintenance)
        const reason = nextState ? (maintenanceReason || null) : null

        await db.query(
            "UPDATE computers SET is_maintenance = $1, maintenance_reason = $2 WHERE id = $3",
            [nextState, reason, computerId]
        )

        let notified = 0
        if (nextState !== (computer.is_maintenance === true)) {
            const message = nextState
                ? `Facility notice: Unit ${computer.pc_number} in ${computer.room_name} is out of service${reason ? ` (${reason})` : ""}.`
                : `Facility notice: Unit ${computer.pc_number} in ${computer.room_name} is back in service.`

            notified = await notifyRoles(NOTIFY_STUDENTS, message)

            await logActivity({
                req,
                action: "unit.maintenance",
                entityType: "computer",
                entityId: computer.id,
                description: nextState
                    ? `Flagged Unit ${computer.pc_number} in ${computer.room_name} as out of service${reason ? ` (${reason})` : ""}`
                    : `Marked Unit ${computer.pc_number} in ${computer.room_name} fixed`,
                metadata: { maintenance: nextState, reason, room: computer.room_name }
            })
        }

        res.json({ message: "Computer status updated", notified })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Failed to update computer status" })
    }
})

module.exports = router
