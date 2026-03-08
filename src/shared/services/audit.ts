/**
 * Audit logging service.
 * Writes to the audit_logs table for security-relevant user actions.
 * Runs client-side; IP address is not available here — it is captured
 * by edge functions for server-side actions (account deletion, etc.).
 */
import { supabase } from '@/shared/lib/supabase'

export type AuditAction =
  | 'medication.created'
  | 'medication.updated'
  | 'medication.discontinued'
  | 'medication.deleted'
  | 'dose.logged'
  | 'care_connection.added'
  | 'care_connection.removed'
  | 'account.delete_initiated'
  | 'vital_thresholds.updated'
  | 'ice_card.viewed'

/**
 * Shape of the metadata column written to audit_logs.
 * All fields are optional; only fields actually used across audit call sites
 * are listed here. The index signature permits future fields without breaking
 * existing callers while still preventing arbitrary `any` assertions.
 */
export interface AuditMetadata {
  /** Browser user-agent string captured at log time, or null in SSR contexts. */
  user_agent?: string | null
  [key: string]: string | number | boolean | null | undefined
}

export interface AuditEventInput {
  action: AuditAction
  entity_type: string
  entity_id?: string
  metadata?: AuditMetadata
}

export const AuditService = {
  async log(event: AuditEventInput): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const metadata: AuditMetadata = {
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        ...event.metadata,
      }

      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: event.action,
        entity_type: event.entity_type,
        entity_id: event.entity_id ?? null,
        metadata: metadata as AuditMetadata,
      })
    } catch {
      // Audit failures must never surface to the user
    }
  },

  /** Fire-and-forget wrapper for use in mutation callbacks */
  logAsync(event: AuditEventInput): void {
    void AuditService.log(event)
  },
}
