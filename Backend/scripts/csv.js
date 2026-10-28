/**
 * Minimal CSV helpers (quoted fields, commas and line breaks inside quotes, "" escapes).
 */
function parseCsv(text) {
    const rows = []
    let row = [], field = "", inQuotes = false
    for (let i = 0; i < text.length; i++) {
        const c = text[i]
        if (inQuotes) {
            if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
            else if (c === '"') inQuotes = false
            else field += c
        } else if (c === '"') inQuotes = true
        else if (c === ",") { row.push(field); field = "" }
        else if (c === "\n" || c === "\r") {
            if (c === "\r" && text[i + 1] === "\n") i++
            row.push(field); field = ""
            if (row.some((v) => v.trim())) rows.push(row)
            row = []
        } else field += c
    }
    row.push(field)
    if (row.some((v) => v.trim())) rows.push(row)

    const [header = [], ...data] = rows
    return data.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] || "").trim()])))
}

function toCsv(records, columns) {
    const escape = (v) => {
        const s = v === null || v === undefined ? "" : String(v)
        return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    return [columns.join(","), ...records.map((r) => columns.map((c) => escape(r[c])).join(","))].join("\n") + "\n"
}

module.exports = { parseCsv, toCsv }
