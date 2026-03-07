// ─── Med Export Service ───────────────────────────────────────────────────────
// Pure TypeScript — no React. Generates a printable HTML medication summary,
// handles browser share/download, and opens a print window.

export interface ExportMedication {
  name: string
  dosage: string | null
  instructions: string | null
  warnings: string | null
  supply?: number | null
  total?: number | null
  pharmacy?: string | null
}

export interface ExportProvider {
  name: string
  specialty: string
  phone: string | null
  email: string | null
}

export interface ExportAppointment {
  title: string
  start_time: string
  doctor: string | null
  location: string | null
}

export interface MedExportData {
  patientName: string
  generatedAt: string // ISO string
  medications: ExportMedication[]
  providers?: ExportProvider[]
  upcomingAppointments?: ExportAppointment[]
  adherencePercent?: number // 0–100
  notes?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatSpecialty(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

// ─── HTML Sections ────────────────────────────────────────────────────────────

function buildMedRows(meds: ExportMedication[]): string {
  if (meds.length === 0) {
    return `<tr><td colspan="5" style="text-align:center;color:#6b7280;padding:20px;">No medications on file.</td></tr>`
  }
  return meds
    .map((med, i) => {
      const bg = i % 2 === 0 ? '#ffffff' : '#f9fafb'
      const supplyText =
        med.supply != null && med.total != null && med.total > 0
          ? `${med.supply} / ${med.total}${med.pharmacy ? `<br><span style="font-size:11px;color:#6b7280;">${escapeHtml(med.pharmacy)}</span>` : ''}`
          : med.supply != null
            ? String(med.supply)
            : '—'

      const warningCell =
        med.warnings
          ? `<span style="color:#b45309;">${escapeHtml(med.warnings)}</span>`
          : '<span style="color:#9ca3af;">None noted</span>'

      return `
      <tr style="background:${bg};">
        <td style="padding:10px 14px;font-weight:600;color:#111827;">${escapeHtml(med.name)}</td>
        <td style="padding:10px 14px;color:#374151;">${escapeHtml(med.dosage) || '—'}</td>
        <td style="padding:10px 14px;color:#374151;">${escapeHtml(med.instructions) || '—'}</td>
        <td style="padding:10px 14px;font-size:13px;">${warningCell}</td>
        <td style="padding:10px 14px;text-align:center;color:#374151;">${supplyText}</td>
      </tr>`
    })
    .join('\n')
}

function buildProvidersSection(providers: ExportProvider[]): string {
  if (providers.length === 0) return ''

  const cards = providers
    .map(p => {
      const contactLines: string[] = []
      if (p.phone) contactLines.push(`<span>&#128222; ${escapeHtml(p.phone)}</span>`)
      if (p.email) contactLines.push(`<span>&#9993; ${escapeHtml(p.email)}</span>`)
      const contactHtml = contactLines.length
        ? `<div style="margin-top:6px;font-size:13px;color:#4b5563;display:flex;flex-direction:column;gap:3px;">${contactLines.join('')}</div>`
        : ''

      return `
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;background:#f9fafb;">
        <div style="font-weight:600;color:#111827;font-size:15px;">${escapeHtml(p.name)}</div>
        <div style="font-size:13px;color:#0891b2;margin-top:2px;">${formatSpecialty(p.specialty)}</div>
        ${contactHtml}
      </div>`
    })
    .join('\n')

  return `
  <section style="margin-top:32px;">
    <h2 style="font-size:16px;font-weight:700;color:#0891b2;border-bottom:2px solid #e0f2fe;padding-bottom:6px;margin-bottom:16px;">
      Care Team
    </h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;">
      ${cards}
    </div>
  </section>`
}

function buildAppointmentsSection(appts: ExportAppointment[]): string {
  if (appts.length === 0) return ''

  const rows = appts
    .map((a, i) => {
      const bg = i % 2 === 0 ? '#ffffff' : '#f0f9ff'
      return `
      <tr style="background:${bg};">
        <td style="padding:10px 14px;font-weight:500;color:#111827;">${escapeHtml(a.title)}</td>
        <td style="padding:10px 14px;color:#374151;">${formatDateTime(a.start_time)}</td>
        <td style="padding:10px 14px;color:#374151;">${escapeHtml(a.doctor) || '—'}</td>
        <td style="padding:10px 14px;color:#374151;">${escapeHtml(a.location) || '—'}</td>
      </tr>`
    })
    .join('\n')

  return `
  <section style="margin-top:32px;">
    <h2 style="font-size:16px;font-weight:700;color:#0891b2;border-bottom:2px solid #e0f2fe;padding-bottom:6px;margin-bottom:16px;">
      Upcoming Appointments
    </h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead>
        <tr style="background:#0891b2;color:#ffffff;">
          <th style="padding:10px 14px;text-align:left;font-weight:600;">Title</th>
          <th style="padding:10px 14px;text-align:left;font-weight:600;">Date &amp; Time</th>
          <th style="padding:10px 14px;text-align:left;font-weight:600;">Provider</th>
          <th style="padding:10px 14px;text-align:left;font-weight:600;">Location</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </section>`
}

function buildAdherenceSection(percent: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  const barColor =
    clamped >= 80 ? '#16a34a' : clamped >= 60 ? '#d97706' : '#dc2626'
  const label =
    clamped >= 80 ? 'Good' : clamped >= 60 ? 'Needs attention' : 'Low'

  return `
  <section style="margin-top:32px;">
    <h2 style="font-size:16px;font-weight:700;color:#0891b2;border-bottom:2px solid #e0f2fe;padding-bottom:6px;margin-bottom:16px;">
      30-Day Adherence
    </h2>
    <div style="display:flex;align-items:center;gap:16px;">
      <div style="flex:1;background:#e5e7eb;border-radius:999px;height:14px;overflow:hidden;">
        <div style="width:${clamped}%;background:${barColor};height:100%;border-radius:999px;transition:width 0.3s;"></div>
      </div>
      <span style="font-size:18px;font-weight:700;color:${barColor};min-width:54px;text-align:right;">${clamped}%</span>
      <span style="font-size:13px;color:#6b7280;">${label}</span>
    </div>
  </section>`
}

function buildNotesSection(notes: string): string {
  if (!notes.trim()) return ''
  return `
  <section style="margin-top:32px;">
    <h2 style="font-size:16px;font-weight:700;color:#0891b2;border-bottom:2px solid #e0f2fe;padding-bottom:6px;margin-bottom:16px;">
      Notes
    </h2>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;font-size:14px;color:#374151;white-space:pre-wrap;">${escapeHtml(notes)}</div>
  </section>`
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates a complete, self-contained HTML document string suitable for
 * printing or saving as a medication report file.
 */
export function generateMedReportHtml(data: MedExportData): string {
  const generatedDateStr = formatDate(data.generatedAt)

  const providersHtml =
    data.providers && data.providers.length > 0
      ? buildProvidersSection(data.providers)
      : ''

  const appointmentsHtml =
    data.upcomingAppointments && data.upcomingAppointments.length > 0
      ? buildAppointmentsSection(data.upcomingAppointments)
      : ''

  const adherenceHtml =
    data.adherencePercent != null
      ? buildAdherenceSection(data.adherencePercent)
      : ''

  const notesHtml = data.notes ? buildNotesSection(data.notes) : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Medication Report — ${escapeHtml(data.patientName)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px 16px 48px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      color: #111827;
      background: #ffffff;
    }
    .page {
      max-width: 800px;
      margin: 0 auto;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      font-size: 14px;
    }
    th, td {
      text-align: left;
      vertical-align: top;
    }
    @media print {
      body { margin: 0; padding: 12px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <header style="background:#0891b2;color:#ffffff;border-radius:10px;padding:24px 28px;margin-bottom:28px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
      <div>
        <div style="font-size:22px;font-weight:800;letter-spacing:-0.5px;">MarinLoop</div>
        <div style="font-size:12px;opacity:0.8;margin-top:2px;">Medication Management</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:18px;font-weight:700;">${escapeHtml(data.patientName)}</div>
        <div style="font-size:12px;opacity:0.85;margin-top:3px;">Generated ${generatedDateStr}</div>
      </div>
    </div>
    <div style="margin-top:16px;font-size:11px;opacity:0.75;border-top:1px solid rgba(255,255,255,0.3);padding-top:10px;">
      This document is for personal reference only. Always follow your healthcare provider's instructions. Not a substitute for professional medical advice.
    </div>
  </header>

  <!-- Medications Table -->
  <section>
    <h2 style="font-size:16px;font-weight:700;color:#0891b2;border-bottom:2px solid #e0f2fe;padding-bottom:6px;margin-bottom:16px;">
      Medications (${data.medications.length})
    </h2>
    <table>
      <thead>
        <tr style="background:#0891b2;color:#ffffff;">
          <th style="padding:10px 14px;font-weight:600;min-width:140px;">Medication</th>
          <th style="padding:10px 14px;font-weight:600;min-width:100px;">Dosage</th>
          <th style="padding:10px 14px;font-weight:600;">Instructions</th>
          <th style="padding:10px 14px;font-weight:600;min-width:140px;">Warnings</th>
          <th style="padding:10px 14px;font-weight:600;text-align:center;min-width:90px;">Supply</th>
        </tr>
      </thead>
      <tbody>
        ${buildMedRows(data.medications)}
      </tbody>
    </table>
  </section>

  ${adherenceHtml}
  ${providersHtml}
  ${appointmentsHtml}
  ${notesHtml}

  <!-- Footer -->
  <footer style="margin-top:48px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-size:11px;color:#9ca3af;">
    Generated by MarinLoop &nbsp;|&nbsp; Not a substitute for professional medical advice<br />
    <span style="font-size:10px;">${escapeHtml(data.generatedAt)}</span>
  </footer>

</div>
</body>
</html>`
}

/**
 * Shares the HTML report file via the Web Share API (if supported and capable
 * of sharing files), or falls back to triggering a browser download.
 */
export async function shareMedReport(
  html: string,
  filename: string = 'marinloop-med-report.html',
): Promise<void> {
  const blob = new Blob([html], { type: 'text/html' })

  if (typeof navigator.share === 'function') {
    const file = new File([blob], filename, { type: 'text/html' })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'Medication Report',
        text: 'My medication summary from MarinLoop',
      })
      return
    }
  }

  // Fallback: trigger a download
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } finally {
    // Revoke after a short delay so Safari has time to initiate the download
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}

/**
 * Opens a new browser window, writes the report HTML into it, and triggers
 * the browser's native print dialog.
 */
export function printMedReport(html: string): void {
  const win = window.open('', '_blank')
  if (!win) return
  const doc = win.document
  doc.write(html)
  doc.close()
  win.print()
}
