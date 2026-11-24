// Small, dependency-free table exporter used by Reservation History and
// Analytics. CSV is a real download, Excel produces an .xls file Excel opens,
// and PDF opens the browser print dialog (Save as PDF).

export const EXPORT_FORMATS = [
    { value: "csv", label: "CSV" },
    { value: "excel", label: "Excel (.xls)" },
    { value: "pdf", label: "PDF (print)" }
]

const escapeHtml = (value) =>
    String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")

const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`

const download = (blob, filename) => {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
}

const buildHtml = (title, columns, rows) => {
    const head = columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")
    const body = rows
        .map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`)
        .join("")

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; padding: 24px; }
    h1 { margin: 0 0 4px; font-size: 20px; }
    .meta { margin: 0 0 18px; font-size: 12px; color: #64748b; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 12px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; text-transform: uppercase; letter-spacing: 0.03em; font-size: 10.5px; }
    tr:nth-child(even) td { background: #f8fafc; }
    @page { margin: 14mm; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p class="meta">Generated ${escapeHtml(new Date().toLocaleString())}</p>
<table>
<thead><tr>${head}</tr></thead>
<tbody>${body}</tbody>
</table>
</body>
</html>`
}

export const exportTable = ({ filename, title, columns, rows, format = "csv" }) => {
    const safeName = String(filename || "export").replace(/[^a-z0-9\-_]+/gi, "-")
    const safeRows = rows.map((row) => columns.map((_, index) => row[index] ?? ""))

    if (format === "csv") {
        const lines = [columns.map(csvCell).join(","), ...safeRows.map((row) => row.map(csvCell).join(","))]
        download(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" }), `${safeName}.csv`)
        return
    }

    if (format === "excel") {
        const html = buildHtml(title, columns, safeRows)
        download(new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" }), `${safeName}.xls`)
        return
    }

    if (format === "pdf") {
        const win = window.open("", "_blank")
        if (!win) throw new Error("Allow pop-ups to export as PDF")

        win.document.open()
        win.document.write(
            buildHtml(title, columns, safeRows).replace(
                "</body>",
                '<script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 150); });</script></body>'
            )
        )
        win.document.close()
        win.focus()
        return
    }

    throw new Error("Unknown export format")
}
