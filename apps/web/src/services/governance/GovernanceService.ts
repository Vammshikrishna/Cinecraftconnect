import { supabase } from '@/integrations/supabase/client';

/**
 * GovernanceService
 * Every staff action that matters is carried out by the database, which re-checks who is asking, applies the change
 * and writes the audit entry itself (part BI). The browser only asks.
 *
 *  - request():        a ban, role change, role revoke, flag change or policy edit. It waits in the approval queue for
 *                      a DIFFERENT staff member of enough rank.
 *  - resolveReport():  Dismiss and Warn run at once; Takedown, Shadowban and Ban wait for a second person.
 *  - approveAction():  the second person's approval; the database performs the action.
 */
export type QueuedAction = 'user.ban' | 'system.config' | 'user.manage_roles' | 'user.revoke_role';
export type ReportAction = 'dismiss' | 'warn' | 'takedown' | 'shadowban' | 'ban';

export class GovernanceService {
  static async request(params: {
    action: QueuedAction;
    targetType: string;
    targetId: string;
    reason: string;
    payload?: Record<string, unknown>;
  }): Promise<{ success: true; pending: true }> {
    const { error } = await (supabase as any).rpc('gov_request_action', {
      p_action: params.action,
      p_target_type: params.targetType,
      p_target_id: params.targetId,
      p_reason: params.reason,
      p_payload: params.payload ?? {},
    });
    if (error) throw new Error(error.message);
    return { success: true, pending: true };
  }

  static async resolveReport(reportId: string, action: ReportAction, note?: string): Promise<{ pending: boolean }> {
    const { data, error } = await (supabase as any).rpc('moderator_resolve_report', {
      p_report_id: reportId,
      p_action: action,
      p_note: note || null,
    });
    if (error) throw new Error(error.message);
    return { pending: !!data?.queued };
  }

  static async claimReport(reportId: string) {
    const { error } = await (supabase as any).rpc('moderator_claim_report', { p_report_id: reportId });
    if (error) throw new Error(error.message);
  }

  /**
   * Raises a case to urgent with a reason and a target (part GA function staff_escalate_report(uuid, text, text)).
   * Before part GA is applied only the one-argument version exists: the case is still raised, without the reason.
   * Reports cannot be edited directly since part CZ.
   */
  static async escalateReport(reportId: string, reason?: string, target: 'admin' | 'super_admin' = 'admin'): Promise<{ recorded: boolean }> {
    if (reason) {
      const { error } = await (supabase as any).rpc('staff_escalate_report', { p_report_id: reportId, p_reason: reason, p_target: target });
      if (!error) return { recorded: true };
      const missing = error.code === 'PGRST202' || error.code === '42883' || /could not find the function/i.test(error.message || '');
      if (!missing) throw new Error(error.message);
    }
    const { error } = await (supabase as any).rpc('staff_escalate_report', { p_report_id: reportId });
    if (error) throw new Error(error.message);
    return { recorded: false };
  }

  /** The database rejects the maker approving their own request and performs the action when it is approved. */
  static async approveAction(pendingId: string) {
    const { error } = await (supabase as any).from('gov_approval_queue').update({ status: 'approved' }).eq('id', pendingId);
    if (error) throw new Error(error.message);
  }

  static async rejectAction(pendingId: string) {
    const { error } = await (supabase as any).from('gov_approval_queue').update({ status: 'rejected' }).eq('id', pendingId);
    if (error) throw new Error(error.message);
  }
}
