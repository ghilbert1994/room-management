/* eslint-disable react-hooks/set-state-in-effect */
import "./AnalyticsReports.css"
import Card from "./Card";
import { PageSkeleton } from "../layout/Loading.jsx";
import { Download } from 'lucide-react'
import { useState, useEffect } from 'react'
import { PAGE_TITLES } from '../lib/pageTitles.js'
import { EXPORT_FORMATS, exportTable } from '../lib/exportTable.js'
import { subscribeToDataChanges } from '../lib/dataEvents.js'
import { useTheme } from '../theme/themeContext.js'
import { themeById } from '../lib/themes.js'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts"

function AnalyticsReports() {
    const { theme } = useTheme()
    const palette = themeById(theme)
    const [analytics, setAnalytics] = useState({
        totalBookings: 0,
        labUsage: [],
        peakHours: []
    })
    const [loading, setLoading] = useState(true)
    const [exportFormat, setExportFormat] = useState("csv")

    const fetchAnalytics = async () => {
        try {
            const response = await fetch(`/api/reservation/analytics`, { credentials: "include" })
            const data = await response.json()
            if (response.ok) {
                setAnalytics(data)
            }
        } catch (error) {
            console.error("Failed to load analytics:", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAnalytics()
    }, [])

    // Keep the report current: react to approvals/cancellations from any tab,
    // poll as a fallback, and refresh when the window regains focus.
    useEffect(() => {
        const unsubscribe = subscribeToDataChanges("bookings:changed", fetchAnalytics)
        const interval = setInterval(fetchAnalytics, 30000)
        const handleFocus = () => fetchAnalytics()

        window.addEventListener("focus", handleFocus)
        return () => {
            unsubscribe()
            clearInterval(interval)
            window.removeEventListener("focus", handleFocus)
        }
    }, [])

    if (loading) return <PageSkeleton label="Loading analytics" stats={4} chart rows={4} columns={5} />

    const topLab = analytics.labUsage.length > 0 ? analytics.labUsage[0].name : "N/A"
    const peakHours = analytics.peakHours || []
    const busiestHour = peakHours.reduce(
        (best, item) => (item.bookings > (best?.bookings || 0) ? item : best),
        null
    )

    const exportAnalytics = () => {
        const columns = ["Section", "Item", "Value"]
        const rows = [
            ["Summary", "Total Approved Reservations", analytics.totalBookings],
            ["Summary", "Most Used Laboratory", topLab],
            ["Summary", "Busiest Hour", busiestHour && busiestHour.bookings > 0 ? busiestHour.hour : "No data"],
            ...analytics.labUsage.map((item) => ["Laboratory Usage", item.name, `${item.value}%`]),
            ...(analytics.weeklyTrends || []).map((item) => ["Reservations by Day", item.day, item.bookings]),
            ...peakHours.map((item) => ["Peak Usage Hours", item.hour, item.bookings])
        ]

        try {
            exportTable({
                filename: `analytics-report-${new Date().toISOString().slice(0, 10)}`,
                title: "Analytics Report",
                columns,
                rows,
                format: exportFormat
            })
        } catch (error) {
            window.alert(error.message)
        }
    }

    return (
        <>
            <div style={{ marginBottom: "8px" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "800", letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                    Reports
                </label>
                <h1 style={{ margin: "4px 0 0", color: "var(--navy-900)", fontSize: "28px" }}>{PAGE_TITLES.analytics}</h1>
            </div>

            <div className="analytics-control">
                <div className="analytics-control-left">
                    <select><option value="">All Time</option></select>
                    <select><option value="">All Departments</option></select>
                </div>
                <div className="analytics-control-right">
                    <select
                        value={exportFormat}
                        onChange={(event) => setExportFormat(event.target.value)}
                        style={{ height: "38px", padding: "0 10px", borderRadius: "6px", border: "1px solid var(--border-strong)", fontWeight: "bold", color: "var(--text-soft)" }}
                    >
                        {EXPORT_FORMATS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                    <button onClick={exportAnalytics}><Download /> Export</button>
                </div>
            </div>

            <div className="analytics-content">
                <Card className="analytics-content-dash" columns={4}>
                    <div className="analytics-content-dash-title">
                        <p>Total Approved Reservations</p>
                        <span>All Time</span>
                    </div>
                    <h1>{analytics.totalBookings.toLocaleString()}</h1>
                    <p>Across all laboratories</p>
                </Card>

                <Card className="analytics-content-dash" columns={4}>
                    <div className="analytics-content-dash-title">
                        <p>Most Used Lab</p>
                    </div>
                    <h1 style={{fontSize: '24px'}}>{topLab}</h1>
                    <p>Highest reservation frequency</p>
                </Card>

                <Card className="analytics-content-dash" columns={4}>
                    <div className="analytics-content-dash-title">
                        <p>System Status</p>
                        <span style={{backgroundColor: '#d9f3e5', color: '#218838'}}>Active</span>
                    </div>
                    <h1>100%</h1>
                    <p>Data synced with database</p>
                </Card>

                <Card className="analytics-content-dash" columns={4}>
                    <div className="analytics-content-dash-title">
                        <p>Database</p>
                        <span>Connected</span>
                    </div>
                    <h1>PostgreSQL</h1>
                    <p>Supabase Cloud</p>
                </Card>

                <Card columns={8} rows={4}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                        <h2 style={{ margin: 0 }}>Peak Usage Hours</h2>
                        <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 700 }}>
                            {busiestHour && busiestHour.bookings > 0
                                ? `Busiest: ${busiestHour.hour} · ${busiestHour.bookings} reservation${busiestHour.bookings === 1 ? "" : "s"}`
                                : "No approved reservations yet"}
                        </span>
                    </div>
                    <ResponsiveContainer width="100%" height="90%">
                        <BarChart data={peakHours} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                            <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={0} angle={-35} textAnchor="end" height={56} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(value) => [`${value} reservation${Number(value) === 1 ? "" : "s"}`, "Approved"]} />
                            <Bar dataKey="bookings" fill={palette.brand} radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>

                <Card columns={8} rows={4} className="analytics-content-usage">
                    <h2> Top Laboratory Usage </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '16px' }}>
                        {analytics.labUsage.map((lab, index) => (
                            <div className="analytics-usage-entry" key={index}>
                                <div className="analytics-usage-entry-top">
                                    <p>{lab.name}</p>
                                    <span>{lab.value}%</span>
                                </div>
                                <div className="progress-bar">
                                    <div className="progress-bar-fill" style={{ width: `${lab.value}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </>
    )
}

export default AnalyticsReports