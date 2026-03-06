import { useCallback, useState } from 'react'
import { useMedications } from '@/shared/hooks/useMedications'
import { useProviders } from '@/shared/hooks/useProviders'
import { useAppointments } from '@/shared/hooks/useAppointments'
import { useAdherenceHistory } from '@/shared/hooks/useAdherenceHistory'
import { useRefillPredictions } from '@/shared/hooks/useRefillPredictions'
import {
  generateMedReportHtml,
  shareMedReport,
  printMedReport,
} from '@/shared/services/med-export'
import type {
  MedExportData,
  ExportMedication,
  ExportProvider,
  ExportAppointment,
} from '@/shared/services/med-export'
import { useAppStore } from '@/shared/stores/app-store'
import type { ProviderSpecialty } from '@/shared/types/care-types'

// ─── Specialty display map ────────────────────────────────────────────────────

const SPECIALTY_LABEL: Record<ProviderSpecialty, string> = {
  primary_care: 'Primary Care',
  cardiologist: 'Cardiologist',
  pharmacist: 'Pharmacist',
  neurologist: 'Neurologist',
  specialist: 'Specialist',
  other: 'Other',
}

// ─── Adherence computation ────────────────────────────────────────────────────
// useAdherenceHistory returns Record<dateString, { t: taken; d: total }>
// We compute a simple percentage from the last 30 days of data.

function computeAdherencePercent(
  adherence: Record<string, { t: number; d: number }>,
): number | undefined {
  const entries = Object.values(adherence)
  if (entries.length === 0) return undefined

  let totalDoses = 0
  let takenDoses = 0
  for (const { t, d } of entries) {
    totalDoses += d
    takenDoses += t
  }
  if (totalDoses === 0) return undefined
  return Math.round((takenDoses / totalDoses) * 100)
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface UseMedExportReturn {
  isExporting: boolean
  exportAndShare: (patientName: string, notes?: string) => Promise<void>
  exportAndPrint: (patientName: string, notes?: string) => Promise<void>
}

export function useMedExport(): UseMedExportReturn {
  const [isExporting, setIsExporting] = useState(false)

  const { meds } = useMedications()
  const { providers } = useProviders()
  const { appts } = useAppointments()
  const { predictions } = useRefillPredictions()
  const { adherence } = useAdherenceHistory(30)
  const { toast } = useAppStore()

  // Build a supply map keyed by med ID from refill predictions
  const supplyMap = new Map(
    predictions.map(p => [p.medId, { supply: p.supply, total: p.total }]),
  )

  // ─── Data builders ──────────────────────────────────────────────────────────

  function buildMedications(): ExportMedication[] {
    return meds.map(med => {
      const supplyInfo = supplyMap.get(med.id)
      return {
        name: med.name,
        dosage: med.dosage,
        instructions: med.instructions,
        warnings: med.warnings,
        supply: supplyInfo?.supply ?? null,
        total: supplyInfo?.total ?? null,
        pharmacy: null, // pharmacy is stored on refills row; not surfaced via predictions
      }
    })
  }

  function buildProviders(): ExportProvider[] {
    return providers.map(p => ({
      name: p.name,
      specialty: SPECIALTY_LABEL[p.specialty] ?? p.specialty,
      phone: p.phone,
      email: p.email,
    }))
  }

  function buildUpcomingAppointments(): ExportAppointment[] {
    const now = new Date().toISOString()
    return appts
      .filter(a => a.start_time > now)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map(a => ({
        title: a.title,
        start_time: a.start_time,
        doctor: a.doctor,
        location: a.location,
      }))
  }

  function buildExportData(
    patientName: string,
    notes: string | undefined,
  ): MedExportData {
    const exportMeds = buildMedications()
    const exportProviders = buildProviders()
    const exportAppts = buildUpcomingAppointments()
    const adherencePercent = computeAdherencePercent(adherence)

    return {
      patientName,
      generatedAt: new Date().toISOString(),
      medications: exportMeds,
      providers: exportProviders.length > 0 ? exportProviders : undefined,
      upcomingAppointments: exportAppts.length > 0 ? exportAppts : undefined,
      adherencePercent,
      notes,
    }
  }

  // ─── Export actions ─────────────────────────────────────────────────────────

  const exportAndShare = useCallback(
    async (patientName: string, notes?: string): Promise<void> => {
      setIsExporting(true)
      try {
        const data = buildExportData(patientName, notes)
        const html = generateMedReportHtml(data)
        await shareMedReport(html)
        toast('Report ready', 'ts')
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to export report'
        toast(message, 'te')
      } finally {
        setIsExporting(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meds, providers, appts, predictions, adherence],
  )

  const exportAndPrint = useCallback(
    async (patientName: string, notes?: string): Promise<void> => {
      setIsExporting(true)
      try {
        const data = buildExportData(patientName, notes)
        const html = generateMedReportHtml(data)
        printMedReport(html)
        toast('Opening print dialog…', 'ts')
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to print report'
        toast(message, 'te')
      } finally {
        setIsExporting(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meds, providers, appts, predictions, adherence],
  )

  return { isExporting, exportAndShare, exportAndPrint }
}
