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

export interface AuditEventInput {
  action: AuditAction
  entity_type: string
  entity_id?: string
  metadata?: Record<string, unknown>
}

export const AuditService = {
  async log(event: AuditEventInput): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const metadata: Record<string, unknown> = {
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        ...event.metadata,
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: event.action,
        entity_type: event.entity_type,
        entity_id: event.entity_id ?? null,
        metadata: metadata as any,
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
