const express = require("express")
const router = express.Router()
const db = require("../db.js")
const { requireAuth, requireCapability } = require("../middleware/auth.js")
const { notifyRoles } = require("../lib/facilityNotify.js")

const STATUS_VALUES = ["processing", "pending", "approved", "rejected", "no_show", "cancelled", "in_progress"]

const normalize = (value) => {
    if (!value) return value
    return String(value).replace("T", " ").trim().slice(0, 16)
}

const isDateTime = (value) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(String(value || ""))

async function findClassConflict(roomId, start, end) {
    const { rows } = await db.query(`
        SELECT ss.id, ss.subject, ss.start_time, ss.end_time
        FROM semester_schedules ss
        JOIN semesters s ON s.id = ss.semester_id
        WHERE ss.room_id = $1
          AND ss.day_of_week = extract(isodow FROM $2::timestamp)
          AND ss.start_time < $3::time
          AND ss.end_time > $2::time
          AND (s.starts_on IS NULL OR $2::date >= s.starts_on)
          AND (s.ends_on IS NULL OR $2::date <= s.ends_on)
          AND NOT EXISTS (
              SELECT 1
              FROM class_cancellations c
              WHERE c.schedule_id = ss.id
                AND c.cancelled_on = $2::date
          )
        LIMIT 1
    `, [roomId, start, end])

    return rows[0] || null
}

const publicReservation = (reservation) => ({
    id: reservation.id,
    title: reservation.room_name,
    room: reservation.room_name,
    start: reservation.time_start,
    end: reservation.time_end,
    status: reservation.status,
    user: "Reserved",
    purpose: null,
    participants: null
})

const staffReservation = (reservation) => ({
    id: reservation.id,
    title: reservation.room_name,
    room: reservation.room_name,
    start: reservation.time_start,
    end: reservation.time_end,
    status: reservation.status,
    purpose: reservation.purpose_label || null,
    purpose_id: reservation.purpose_id,
    purpose_notes: reservation.purpose_notes || null,
    participants: reservation.participants,
    created_at: reservation.created_at,
    section_id: reservation.section_id || null,
    section: reservation.section_label || null,
    user: reservation.user_name || reservation.user_email
})

// Controlled vocabulary for the purpose dropdown. Kept server-side so the
// React form and the API validator cannot disagree (see migration 006).
router.get("/purposes", requireAuth, async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT id, label, description
            FROM reservation_purposes
            WHERE is_active
            ORDER BY sort_order, label
        `)
        res.json({ purposes: rows })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Failed to retrieve reservation purposes" })
    }
})

const asPurposeId = (value) => {
    const id = Number(value)
    return Number.isInteger(id) && id > 0 ? id : null
}

async function resolvePurpose(purposeId, client = db) {
    const id = asPurposeId(purposeId)
    if (!id) return null
    const { rows } = await client.query(
        "SELECT id, label FROM reservation_purposes WHERE id = $1 AND is_active",
        [id]
    )
    return rows[0] || null
}

const cleanNotes = (value) => {
    const text = String(value || "").trim()
    return text === "" ? null : text.slice(0, 500)
}

async function resolveSection(sectionId) {
    const id = Number(sectionId)
    if (!Number.isInteger(id) || id <= 0) return null

    const { rows } = await db.query(
        "SELECT id, course, year_level, name FROM sections WHERE id = $1 AND is_active",
        [id]
    )
    if (rows.length === 0) return null

    return {
        ...rows[0],
        label: `${rows[0].course} ${rows[0].year_level} ${rows[0].name}`
    }
}

router.get("/all", requireAuth, async (req, res) => {
    try {
        const { scope, status, from, to } = req.query
        const conditions = []
        const params = []

        // Stored reservation times are wall-clock Asia/Manila, so "now" is too.
        // A reservation is archived once its lifecycle is finished: rejected,
        // cancelled, or ended. Pending requests stay actionable even if their
        // date has passed, which is why every row lands in exactly one scope.
        if (scope === "active") {
            conditions.push(`(
                reservations.status not in ('rejected', 'cancelled', 'no_show')
                and (
                    reservations.status = 'pending'
                    or reservations.time_end >= (now() at time zone 'Asia/Manila')::timestamp
                )
            )`)
        } else if (scope === "history") {
            conditions.push(`(
                reservations.status in ('rejected', 'cancelled', 'no_show')
                or (
                    reservations.status <> 'pending'
                    and reservations.time_end < (now() at time zone 'Asia/Manila')::timestamp
                )
            )`)
        }

        if (status && STATUS_VALUES.includes(status)) {
            params.push(status)
            conditions.push(`reservations.status = $${params.length}`)
        }
        if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
            params.push(from)
            conditions.push(`reservations.time_start >= $${params.length}::date`)
        }
        if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
            params.push(to)
            conditions.push(`reservations.time_start < ($${params.length}::date + interval '1 day')`)
        }

        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""
        const { rows } = await db.query(`
            SELECT
                reservations.id,
                reservations.time_start,
                reservations.time_end,
                reservations.status,
                reservations.purpose_id,
                reservations.purpose_notes,
                reservations.participants,
                reservations.created_at,
                reservations.section_id,
                sections.course || ' ' || sections.year_level || ' ' || sections.name AS section_label,
                purposes.label AS purpose_label,
                rooms.id AS room_id,
                rooms.name AS room_name,
                rooms.room_type,
                users.id AS user_id,
                users.name AS user_name,
                users.email AS user_email
            FROM reservations
            JOIN rooms ON reservations.room_id = rooms.id
            JOIN users ON reservations.reserved_by = users.id
            LEFT JOIN reservation_purposes AS purposes ON purposes.id = reservations.purpose_id
            LEFT JOIN sections ON sections.id = reservations.section_id
            ${where}
            ORDER BY reservations.time_start ASC
        `, params)

        const isStaff = req.user.role !== "student"
        const blocks = await db.query(`
            SELECT ss.id AS schedule_id,
                   ss.semester_id,
                   s.school_year,
                   s.term,
                   d::date AS date,
                   ss.start_time,
                   ss.end_time,
                   ss.room_id,
                   rooms.name AS room_name,
                   ss.subject,
                   ss.subject_code,
                   ss.course,
                   ss.year_level,
                   ss.section,
                   ss.instructor,
                   ss.instructor_id
            FROM semester_schedules ss
            JOIN semesters s ON s.id = ss.semester_id
            LEFT JOIN rooms ON rooms.id = ss.room_id
            CROSS JOIN LATERAL generate_series(s.starts_on, s.ends_on, interval '1 day') AS d
            WHERE s.starts_on IS NOT NULL
              AND s.ends_on IS NOT NULL
              AND extract(isodow FROM d) = ss.day_of_week
              AND NOT EXISTS (
                  SELECT 1
                  FROM class_cancellations c
                  WHERE c.schedule_id = ss.id
                    AND c.cancelled_on = d::date
              )
            ORDER BY d ASC, ss.start_time ASC
        `)
        const classBlocks = blocks.rows

        res.json({
            reservations: rows.map(isStaff ? staffReservation : publicReservation),
            classBlocks
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Failed to retrieve reservations" })
    }
})

router.get("/get", requireAuth, async (req, res) => {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: "Reservation ID is required" })

    try {
        const { rows } = await db.query(`
            SELECT
                reservations.id,
                reservations.time_start,
                reservations.time_end,
                reservations.status,
                reservations.purpose_id,
                reservations.purpose_notes,
                reservations.participants,
                reservations.created_at,
                reservations.section_id,
                sections.course || ' ' || sections.year_level || ' ' || sections.name AS section_label,
                purposes.label AS purpose_label,
                rooms.id AS room_id,
                rooms.name AS room_name,
                rooms.room_type,
                users.id AS user_id,
                users.name AS user_name,
                users.email AS user_email
            FROM reservations
            JOIN rooms ON reservations.room_id = rooms.id
            JOIN users ON reservations.reserved_by = users.id
            LEFT JOIN reservation_purposes AS purposes ON purposes.id = reservations.purpose_id
            LEFT JOIN sections ON sections.id = reservations.section_id
            WHERE reservations.id = $1
        `, [id])

        if (rows.length === 0) return res.status(404).json({ error: "Reservation not found" })

        const reservation = rows[0]
        res.json({
            reservation: req.user.role === "student" ? publicReservation(reservation) : staffReservation(reservation)
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Failed to retrieve reservation" })
    }
})

router.get("/mine", requireAuth, async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT reservations.id,
                   reservations.time_start,
                   reservations.time_end,
                   reservations.status,
                   reservations.purpose_id,
                   reservations.purpose_notes,
                   reservations.participants,
                   reservations.created_at,
                   reservations.section_id,
                   sections.course || ' ' || sections.year_level || ' ' || sections.name AS section_label,
                   purposes.label AS purpose_label,
                   rooms.id AS room_id,
                   rooms.name AS room_name,
                   rooms.room_type,
                   users.id AS user_id,
                   users.name AS user_name,
                   users.email AS user_email
            FROM reservations
            JOIN rooms ON rooms.id = reservations.room_id
            JOIN users ON users.id = reservations.reserved_by
            LEFT JOIN reservation_purposes AS purposes ON purposes.id = reservations.purpose_id
            LEFT JOIN sections ON sections.id = reservations.section_id
            WHERE reservations.reserved_by = $1
            ORDER BY reservations.time_start DESC
        `, [req.user.id])

        res.json({ reservations: rows.map(staffReservation) })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Failed to retrieve your reservations" })
    }
})

router.post("/:id/follow-up", requireAuth, async (req, res) => {
    const { id } = req.params
    const text = String(req.body?.message || "").trim().slice(0, 500)

    try {
        const { rows } = await db.query(`
            SELECT reservations.id,
                   reservations.reserved_by,
                   reservations.status,
                   reservations.time_start,
                   rooms.name AS room_name
            FROM reservations
            JOIN rooms ON rooms.id = reservations.room_id
            WHERE reservations.id = $1
        `, [id])

        if (rows.length === 0) return res.status(404).json({ error: "Reservation not found" })

        const reservation = rows[0]
        const isOwner = String(reservation.reserved_by) === String(req.user.id)
        if (req.user.role !== "admin" && !isOwner) {
            return res.status(403).json({ error: "You can only follow up on your own reservations" })
        }

        const label = `${reservation.room_name} on ${String(reservation.time_start).slice(0, 10)}`
        const detail = text || "Please check the status of my reservation."
        const notified = await notifyRoles(
            ["admin"],
            `Follow-up from ${req.user.name || req.user.email}: ${detail} (${label}, status: ${reservation.status}).`
        )

        res.json({ message: "Follow-up sent to the admin", notified })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Failed to send follow-up" })
    }
})

router.post("/add", requireAuth, requireCapability("bookingCreate"), async (req, res) => {
    const { roomId, reservedBy, timeStart, timeEnd, status, purposeId, purposeNotes, participants, sectionId } = req.body

    if (!roomId || !reservedBy || !timeStart || !timeEnd || !purposeId || !participants) {
        return res.status(400).json({ error: "Room, user, start time, end time, purpose, and participants are required" })
    }

    const start = normalize(timeStart)
    const end = normalize(timeEnd)

    if (!isDateTime(start) || !isDateTime(end)) {
        return res.status(400).json({ error: "Start and end must be valid date and time values" })
    }

    if (start >= end) return res.status(400).json({ error: "End time must be after start time" })

    if (req.user.role !== "admin" && String(reservedBy) !== String(req.user.id)) {
        return res.status(403).json({ error: "You can only create reservations for yourself" })
    }

    if (status && !STATUS_VALUES.includes(status)) {
        return res.status(400).json({ error: "Invalid reservation status" })
    }

    try {
        const purpose = await resolvePurpose(purposeId)
        if (!purpose) {
            return res.status(400).json({ error: "Choose a valid reservation purpose" })
        }

        const notes = cleanNotes(purposeNotes)
        if (purpose.label === "Others" && !notes) {
            return res.status(400).json({ error: "Please describe the purpose when choosing Others" })
        }

        const section = await resolveSection(sectionId)
        if (sectionId && !section) {
            return res.status(400).json({ error: "That section was not found" })
        }
        if (!section && req.user.role === "faculty") {
            return res.status(400).json({ error: "Choose the section for this reservation" })
        }

        const roomResult = await db.query(
            "SELECT id, name, maintenance, room_type FROM rooms WHERE id = $1",
            [roomId]
        )
        if (roomResult.rows.length === 0) return res.status(404).json({ error: "Laboratory not found" })
        if (roomResult.rows[0].room_type !== "laboratory") {
            return res.status(400).json({ error: "Only laboratories can be reserved" })
        }
        if (roomResult.rows[0].maintenance) {
            return res.status(409).json({ error: "Laboratory is currently under maintenance" })
        }

        const userResult = await db.query("SELECT id, name FROM users WHERE id = $1", [reservedBy])
        if (userResult.rows.length === 0) return res.status(404).json({ error: "User not found" })

        const classConflict = await findClassConflict(roomId, start, end)
        if (classConflict) {
            return res.status(409).json({
                error: `This room has a class scheduled at that time (${classConflict.subject}).`
            })
        }

        const overlapResult = await db.query(`
            SELECT id FROM reservations
            WHERE room_id = $1
              AND time_start < $3::timestamp
              AND time_end > $2::timestamp
              AND status NOT IN ('rejected', 'cancelled')
        `, [roomId, start, end])

        if (overlapResult.rows.length > 0) {
            return res.status(409).json({ error: "Laboratory is already reserved during this time" })
        }

        const reservationStatus = status || "pending"
        const { rows } = await db.query(`
            INSERT INTO reservations (time_start, time_end, reserved_by, room_id, status, purpose_id, purpose_notes, participants, section_id)
            VALUES ($1::timestamp, $2::timestamp, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, time_start, time_end, reserved_by, room_id, status, purpose_id, purpose_notes, participants, section_id
        `, [start, end, reservedBy, roomId, reservationStatus, purpose.id, notes, participants, section?.id || null])

        const coordinatorMessage = `New reservation request for ${roomResult.rows[0].name} by ${userResult.rows[0].name}.`
        await notifyRoles(["admin"], coordinatorMessage)

        res.status(201).json({
            message: "Reservation created successfully",
            reservation: { ...rows[0], purpose: purpose.label, section: section?.label || null }
        })
    } catch (error) {
        console.error(error)
        if (error.code === "23P01") return res.status(409).json({ error: "Laboratory is already reserved during this time" })
        if (error.code === "22P02" || error.code === "22007") {
            return res.status(400).json({ error: "Invalid reservation data" })
        }
        res.status(500).json({ error: "Failed to create reservation" })
    }
})

router.put("/edit", requireAuth, async (req, res) => {
    const { id, roomId, reservedBy, timeStart, timeEnd, status, purposeId, purposeNotes, participants, sectionId } = req.body
    if (!id || !roomId || !reservedBy || !timeStart || !timeEnd || !status || !purposeId || !participants) {
        return res.status(400).json({ error: "All fields are required" })
    }

    if (!STATUS_VALUES.includes(status)) {
        return res.status(400).json({ error: "Invalid reservation status" })
    }

    const start = normalize(timeStart)
    const end = normalize(timeEnd)

    if (!isDateTime(start) || !isDateTime(end)) {
        return res.status(400).json({ error: "Start and end must be valid date and time values" })
    }

    if (start >= end) return res.status(400).json({ error: "End time must be after start time" })

    try {
        const purpose = await resolvePurpose(purposeId)
        if (!purpose) {
            return res.status(400).json({ error: "Choose a valid reservation purpose" })
        }

        const notes = cleanNotes(purposeNotes)
        if (purpose.label === "Others" && !notes) {
            return res.status(400).json({ error: "Please describe the purpose when choosing Others" })
        }

        const section = await resolveSection(sectionId)
        if (sectionId && !section) {
            return res.status(400).json({ error: "That section was not found" })
        }
        if (!section && req.user.role === "faculty") {
            return res.status(400).json({ error: "Choose the section for this reservation" })
        }

        const reservationResult = await db.query(
            "SELECT id, reserved_by FROM reservations WHERE id = $1",
            [id]
        )
        if (reservationResult.rows.length === 0) return res.status(404).json({ error: "Reservation not found" })

        const existing = reservationResult.rows[0]
        const isOwner = String(existing.reserved_by) === String(req.user.id)
        if (req.user.role !== "admin" && !isOwner) {
            return res.status(403).json({ error: "You can only edit your own reservation" })
        }

        const effectiveReservedBy = req.user.role === "admin" ? reservedBy : req.user.id

        const roomResult = await db.query("SELECT id, maintenance FROM rooms WHERE id = $1", [roomId])
        if (roomResult.rows.length === 0) return res.status(404).json({ error: "Laboratory not found" })
        if (roomResult.rows[0].maintenance) {
            return res.status(409).json({ error: "Laboratory is currently under maintenance" })
        }

        const classConflict = await findClassConflict(roomId, start, end)
        if (classConflict) {
            return res.status(409).json({
                error: `This room has a class scheduled at that time (${classConflict.subject}).`
            })
        }

        const overlapResult = await db.query(`
            SELECT id FROM reservations
            WHERE room_id = $1
              AND time_start < $3::timestamp
              AND time_end > $2::timestamp
              AND id != $4
              AND status NOT IN ('rejected', 'cancelled')
        `, [roomId, start, end, id])

        if (overlapResult.rows.length > 0) {
            return res.status(409).json({ error: "Laboratory is already reserved during this time" })
        }

        const { rows } = await db.query(`
            UPDATE reservations
            SET time_start = $1::timestamp, time_end = $2::timestamp, reserved_by = $3,
                room_id = $4, status = $5, purpose_id = $6, purpose_notes = $7, participants = $8,
                section_id = $9
            WHERE id = $10
            RETURNING id, time_start, time_end, reserved_by, room_id, status, purpose_id, purpose_notes, participants, section_id
        `, [start, end, effectiveReservedBy, roomId, status, purpose.id, notes, participants, section?.id || null, id])

        res.json({
            message: "Reservation updated successfully",
            reservation: { ...rows[0], purpose: purpose.label, section: section?.label || null }
        })
    } catch (error) {
        console.error(error)
        if (error.code === "23P01") return res.status(409).json({ error: "Laboratory is already reserved during this time" })
        if (error.code === "22P02" || error.code === "22007") {
            return res.status(400).json({ error: "Invalid reservation data" })
        }
        res.status(500).json({ error: "Failed to update reservation" })
    }
})

router.put("/update-status", requireAuth, requireCapability("bookingManage"), async (req, res) => {
    const { id, status } = req.body

    if (!STATUS_VALUES.includes(status)) {
        return res.status(400).json({ error: "Invalid reservation status" })
    }

    try {
        const resInfo = await db.query(`
            SELECT reservations.reserved_by, rooms.name AS room_name
            FROM reservations
            JOIN rooms ON reservations.room_id = rooms.id
            WHERE reservations.id = $1
        `, [id])

        if (resInfo.rows.length === 0) return res.status(404).json({ error: "Reservation not found" })

        const { reserved_by, room_name } = resInfo.rows[0]

        await db.query("UPDATE reservations SET status = $1 WHERE id = $2::bigint", [status, id])

        await db.query(
            "INSERT INTO notifications (user_id, message) VALUES ($1, $2)",
            [reserved_by, `Your reservation for ${room_name} was ${status}.`]
        )

        res.json({ message: `Reservation ${status}` })
    } catch (error) {
        console.error(error)
        if (error.code === "23P01") return res.status(409).json({ error: "This change conflicts with another reservation" })
        res.status(500).json({ error: "Failed to update status" })
    }
})

router.delete("/delete", requireAuth, async (req, res) => {
    const { id } = req.body
    const user = req.user

    if (!id) return res.status(400).json({ error: "Reservation ID is required" })

    try {
        const resRes = await db.query(
            "SELECT id, reserved_by FROM reservations WHERE id = $1",
            [id]
        )

        if (resRes.rows.length === 0) return res.status(404).json({ error: "Reservation not found" })
        const reservation = resRes.rows[0]

        const canDelete = user.role === "admin"
            || user.role === "mis_staff"
            || String(user.id) === String(reservation.reserved_by)

        if (!canDelete) {
            return res.status(403).json({ error: "You do not have permission to cancel this reservation" })
        }

        await db.query("DELETE FROM reservations WHERE id = $1", [id])
        res.json({ message: "Reservation deleted successfully" })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Failed to delete reservation" })
    }
})

router.get("/analytics", requireAuth, requireCapability("analyticsRead"), async (req, res) => {
    try {
        const totalBookingsResult = await db.query("SELECT COUNT(*) FROM reservations WHERE status = 'approved'")
        const totalBookings = parseInt(totalBookingsResult.rows[0].count)

        const labUsageResult = await db.query(`
            SELECT rooms.name, COUNT(reservations.id) as count
            FROM reservations
            JOIN rooms ON reservations.room_id = rooms.id
            WHERE reservations.status = 'approved'
            GROUP BY rooms.name
            ORDER BY count DESC
        `)

        const labUsage = labUsageResult.rows.map(row => ({
            name: row.name,
            value: totalBookings > 0 ? Math.round((parseInt(row.count) / totalBookings) * 100) : 0
        }))

        const weeklyTrendsResult = await db.query(`
            SELECT EXTRACT(ISODOW FROM time_start) as day_num, COUNT(*) as count
            FROM reservations
            WHERE status = 'approved'
            GROUP BY day_num
        `)

        const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        const weeklyTrends = daysOfWeek.map(day => ({ day, bookings: 0 }))

        weeklyTrendsResult.rows.forEach(row => {
            const index = parseInt(row.day_num) - 1
            if (index >= 0 && index < 7) {
                weeklyTrends[index].bookings = parseInt(row.count)
            }
        })

        res.json({ totalBookings, labUsage, weeklyTrends })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Failed to generate analytics" })
    }
})

module.exports = router
