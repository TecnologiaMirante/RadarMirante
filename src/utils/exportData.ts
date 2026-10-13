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

export function exportXlsx(rows: ExportRow[], headers: string[], filename: string, sheetName = 'Dados') {
  const wsData = [headers, ...rows.map(row => headers.map(h => row[h] ?? ''))]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Auto column widths
  const colWidths = headers.map((h) => ({
    wch: Math.max(
      h.length,
      ...rows.map(r => String(r[h] ?? '').length),
    ) + 2,
  }))
  ws['!cols'] = colWidths

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename)
}
