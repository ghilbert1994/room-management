import { useMemo, useState } from "react"
import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar"
import { format, parse, startOfWeek, getDay } from "date-fns"
import { enUS } from "date-fns/locale"
import "react-big-calendar/lib/css/react-big-calendar.css"
import { useMediaQuery } from "../lib/useMediaQuery.js"
import { classEventsForWeek } from "../lib/classTimetable.js"

const locales = { "en-US": enUS }
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales })

function WeeklyClassCalendar({ schedules, height }) {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [currentView, setCurrentView] = useState(null)
    const isNarrow = useMediaQuery("(max-width: 760px)")
    const view = currentView || (isNarrow ? Views.DAY : Views.WEEK)

    const events = useMemo(
        () => classEventsForWeek(schedules, currentDate),
        [schedules, currentDate]
    )

    return (
        <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            titleAccessor="title"
            date={currentDate}
            view={view}
            onNavigate={(newDate) => setCurrentDate(newDate)}
            onView={(newView) => setCurrentView(newView)}
            views={["week", "day"]}
            step={30}
            timeslots={2}
            min={new Date(1970, 0, 1, 7, 0)}
            max={new Date(1970, 0, 1, 20, 0)}
            popup
            eventPropGetter={() => ({
                style: {
                    backgroundColor: "var(--navy-700)",
                    borderLeft: "4px solid var(--accent)",
                    borderRadius: 4,
                    color: "#ffffff"
                }
            })}
            style={{ height: height || (isNarrow ? 480 : 600) }}
        />
    )
}

export default WeeklyClassCalendar
