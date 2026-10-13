import * as XLSX from 'xlsx'

export type ExportRow = Record<string, string | number | null | undefined>

function toCsv(rows: ExportRow[], headers: string[]): string {
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const lines = [
    headers.map(escape).join(','),
    ...rows.map(row => headers.map(h => escape(row[h])).join(',')),
  ]
  return '﻿' + lines.join('\r\n')
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportCsv(rows: ExportRow[], headers: string[], filename: string) {
  const csv = toCsv(rows, headers)
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename)
}

// Strip lone surrogates and invalid XML control characters that break XLSX serialization
function sanitizeStr(v: ExportRow[string]): ExportRow[string] {
  if (typeof v !== 'string') return v
  return v
    .replace(/[\uD800-\uDFFF]/g, '')          // lone surrogates
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // invalid XML ctrl chars
}

export function exportXlsx(rows: ExportRow[], headers: string[], filename: string, sheetName = 'Dados') {
  const safe = rows.map(row =>
    Object.fromEntries(headers.map(h => [h, sanitizeStr(row[h])])) as ExportRow
  )
  const ws = XLSX.utils.json_to_sheet(safe, { header: headers })

  // Cap column width at 80 to avoid overflow issues
  const colWidths = headers.map(h => {
    const maxLen = rows.reduce((acc, r) => Math.max(acc, String(r[h] ?? '').length), h.length)
    return { wch: Math.min(80, maxLen + 2) }
  })
  ws['!cols'] = colWidths

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename)
}
