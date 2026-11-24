const shortTime = (value) => String(value || "").slice(0, 5)

const timeToParts = (value) => {
    const [hour, minute] = shortTime(value).split(":").map(Number)
    return { hour: Number.isFinite(hour) ? hour : 0, minute: Number.isFinite(minute) ? minute : 0 }
}

export const weekStartFor = (date) => {
    const start = new Date(date)
    const offset = (start.getDay() + 6) % 7 // Monday = 0
    start.setDate(start.getDate() - offset)
    start.setHours(0, 0, 0, 0)
    return start
}

// Semester class entries repeat weekly (day_of_week + times), so build the
// events for the week that the calendar is currently showing.
export const classEventsForWeek = (schedules, referenceDate) => {
    const weekStart = weekStartFor(referenceDate)

    return (schedules || []).map((item) => {
        const date = new Date(weekStart)
        date.setDate(weekStart.getDate() + (Number(item.day_of_week) - 1))

        const startParts = timeToParts(item.start_time)
        const endParts = timeToParts(item.end_time)

        const start = new Date(date)
        start.setHours(startParts.hour, startParts.minute, 0, 0)

        const end = new Date(date)
        end.setHours(endParts.hour, endParts.minute, 0, 0)

        return {
            id: item.id,
            title: `${item.subject}${item.room_name ? ` · ${item.room_name}` : ""}`,
            start,
            end,
            resource: item
        }
    })
}
