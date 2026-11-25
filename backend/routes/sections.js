const express = require("express")
const router = express.Router()
const db = require("../db.js")
const { requireAuth } = require("../middleware/auth.js")

const LIST_QUERY = `
    SELECT id,
           course,
           year_level,
           name,
           course || ' ' || year_level || ' ' || name AS label
    FROM sections
    WHERE is_active
    ORDER BY course ASC, year_level ASC, name ASC
`

// Public list so the registration form can offer sections before sign-in.
router.get("/public", async (req, res) => {
    try {
        const { rows } = await db.query(LIST_QUERY)
        res.json({ sections: rows })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Failed to load sections" })
    }
})

router.get("/", requireAuth, async (req, res) => {
    try {
        const { rows } = await db.query(LIST_QUERY)
        res.json({ sections: rows })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Failed to load sections" })
    }
})

module.exports = router
