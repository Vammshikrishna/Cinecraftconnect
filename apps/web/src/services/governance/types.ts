/**
 * CineCraft Connect Governance OS - Type Definitions
 */

export type GovernanceRole = 'moderator' | 'admin' | 'super_admin';

export type GovernanceAction = 
  | 'user.view_private'
  | 'user.warn'
  | 'user.ban'
  | 'user.delete'
  | 'user.verify'
  | 'user.manage_roles'
  | 'content.delete'
  | 'content.edit'
  | 'content.restore'
  | 'report.claim'
  | 'report.resolve'
  | 'report.escalate'
  | 'announcement.publish'
  | 'support.resolve'
  | 'system.config'
  | 'system.maintenance'
  | 'system.audit_view'
  | 'finance.view'
  | 'finance.manage'
  | 'chat.request_access'
  | 'chat.approve_access'
  | 'chat.emergency_access';

export interface GovernanceScope {
  region?: string[];
  category?: string[];
  entity_id?: string[];
  global?: boolean;
}

export interface GovernancePermission {
  action: GovernanceAction;
  scope: GovernanceScope;
  requires_approval: boolean;
}

export interface AuditRecord {
  id: string;
  actor_id: string;
  action: GovernanceAction;
  target_id: string;
  target_type: string;
  before_state: any;
  after_state: any;
  reason: string;
  timestamp: string;
  ip_address?: string;
  user_agent?: string;
  scope: GovernanceScope;
}

export interface PendingAction {
  id: string;
  maker_id: string;
  action: GovernanceAction;
  data: any;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  expires_at: string;
}
