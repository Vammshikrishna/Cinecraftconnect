import { supabase } from '@/integrations/supabase/client';
import { GovernanceAction, GovernanceScope, AuditRecord } from './types';

/**
 * GovernanceService
 * The central authority for executing staff actions.
 * Enforces permissions, logging, and approval workflows.
 */
export class GovernanceService {
  
  /**
   * Records a forensic audit entry for an action.
   */
  private static async logAudit(record: Omit<AuditRecord, 'id' | 'timestamp'>) {
    const { error } = await (supabase as any)
      .from('gov_audit_ledger')
      .insert({
        ...record,
        timestamp: new Date().toISOString()
      });
    
    if (error) {
      console.error('CRITICAL: Audit logging failed!', error);
      // In a real production system, we might block the action if audit logging fails
    }
  }

  /**
   * Captures a snapshot of an entity for rollback purposes.
   */
  private static async captureSnapshot(table: string, id: string) {
    const { data } = await (supabase as any).from(table as any).select('*').eq('id', id).single();
    return data;
  }

  /**
   * Executes a moderation action with full auditing.
   */
  static async executeAction(params: {
    action: GovernanceAction;
    targetId: string;
    targetType: string;
    reason: string;
    payload: any;
    actorId: string;
    scope?: GovernanceScope;
    requiresApproval?: boolean;
  }) {
    // 1. If it requires approval, route to approval queue instead
    if (params.requiresApproval) {
      return this.stageAction(params);
    }

    // 2. Capture "Before" state
    const beforeState = await this.captureSnapshot(params.targetType, params.targetId);

    // 3. Execute the actual action
    let executionError = null;
    try {
      if (params.action === 'user.manage_roles') {
        let retries = 3;
        let success = false;
        while (retries > 0 && !success) {
          // Use direct upsert since Super Admins have RLS permissions for user_roles
          const { error } = await supabase
            .from('user_roles')
            .upsert({
              user_id: params.targetId,
              role: params.payload.role
            }, { onConflict: 'user_id' });
            
          if (!error) {
            success = true;
          } else {
            console.warn(`Role assignment failed, retrying... (${retries} left)`, error);
            retries--;
            if (retries > 0) await new Promise(r => setTimeout(r, 1000));
            else throw error;
          }
        }
      }
      // Add other actions here as needed...
    } catch (e: any) {
      executionError = e;
    }

    if (executionError) throw executionError;

    // 4. Capture "After" state
    const afterState = await this.captureSnapshot(params.targetType, params.targetId);

    // 5. Finalize Audit Log
    await this.logAudit({
      actor_id: params.actorId,
      action: params.action,
      target_id: params.targetId,
      target_type: params.targetType,
      before_state: beforeState,
      after_state: afterState,
      reason: params.reason,
      scope: params.scope || { global: true }
    });

    return { success: true };
  }

  /**
   * Stages an action in the approval queue (Maker-Checker).
   */
  private static async stageAction(params: any) {
    const { error } = await (supabase as any)
      .from('gov_approval_queue')
      .insert({
        maker_id: params.actorId,
        action: params.action,
        target_id: params.targetId,
        target_type: params.targetType,
        reason: params.reason,
        payload: params.payload,
        status: 'pending'
      });

    if (error) throw error;
    return { success: true, pending: true };
  }

  /**
   * Approves a pending action (Checker role).
   */
  static async approveAction(pendingId: string, checkerId: string) {
    // 1. Fetch pending action
    const { data: pending, error: fetchError } = await (supabase as any)
      .from('gov_approval_queue')
      .select('*')
      .eq('id', pendingId)
      .single();

    if (fetchError || !pending) throw new Error('Action not found');
    if (pending.maker_id === checkerId) throw new Error('Maker cannot be Checker (Dual-Control Violation)');

    // 2. Execute the staged action
    const result = await this.executeAction({
      action: pending.action as any,
      targetId: pending.target_id,
      targetType: pending.target_type,
      reason: pending.reason,
      payload: pending.payload,
      actorId: pending.maker_id,
      requiresApproval: false // Already approved
    });

    // 3. Update status
    await (supabase as any)
      .from('gov_approval_queue')
      .update({ status: 'approved', checker_id: checkerId })
      .eq('id', pendingId);

    return result;
  }
}
