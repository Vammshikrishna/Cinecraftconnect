import { useAuth } from '@/contexts/AuthContext';
import { GovernanceAction, GovernanceScope } from '@/services/governance/types';

/** Pure scope rule used by hasPermission (exported so it can be unit tested). */
export const scopeAllows = (
  role: string,
  assigned: GovernanceScope | null | undefined,
  requested?: GovernanceScope,
): boolean => {
  if (role === 'super_admin') return true;
  if (!requested) return true;
  if (requested.global) return false;
  for (const key of ['region', 'category', 'entity_id'] as const) {
    const want = requested[key];
    if (!want || want.length === 0) continue;
    const have = assigned?.[key];
    if (!have || have.length === 0) continue; // nothing assigned for this dimension = not restricted
    if (!want.every(v => have.includes(v))) return false;
  }
  return true;
};

/**
 * useGovernance Hook
 * Centralizes permission validation, scoping, and operational safety checks.
 */
export const useGovernance = () => {
  const { profile } = useAuth();
  
  // Basic role-to-permission mapping (Initial implementation)
  // This will eventually be fetched from gov_role_permissions table
  const getRolePermissions = (role: string): GovernanceAction[] => {
    switch (role) {
      case 'moderator':
        return [
          'report.claim', 'report.resolve', 'report.escalate',
          'user.warn', 'user.ban', 'content.delete'
        ];
      case 'admin':
        return [
          'report.claim', 'report.resolve', 'report.escalate',
          'user.warn', 'user.ban', 'content.delete',
          'user.view_private', 'user.verify', 'announcement.publish',
          'support.resolve', 'content.edit', 'content.restore'
        ];
      case 'super_admin':
        return [
          'report.claim', 'report.resolve', 'report.escalate',
          'user.warn', 'user.ban', 'content.delete',
          'user.view_private', 'user.verify', 'announcement.publish',
          'support.resolve', 'content.edit', 'content.restore',
          'user.manage_roles', 'user.delete', 'system.config',
          'system.maintenance', 'system.audit_view', 'finance.view', 'finance.manage'
        ];
      default:
        return [];
    }
  };

  /**
   * Checks if the current staff member has permission for a specific action and scope.
   */
  const hasPermission = (action: GovernanceAction, scope?: GovernanceScope): boolean => {
    if (!profile || !profile.role) return false;
    
    const permissions = getRolePermissions(profile.role);
    const hasBasePermission = permissions.includes(action);
    
    if (!hasBasePermission) return false;

    // Scope check (F-08). Super admin is unrestricted. A request for the global scope is super admin only.
    // Otherwise, if the staff member has assigned scopes (profile.staff_scope), every region / category / entity asked for
    // must be inside what is assigned; a dimension with nothing assigned is not restricted. The server still enforces the real limits.
    return scopeAllows(profile.role, (profile as any).staff_scope, scope);
  };


  /**
   * Returns whether an action requires approval (Maker-Checker)
   */
  const requiresApproval = (action: GovernanceAction): boolean => {
    const criticalActions: GovernanceAction[] = [
      'user.ban', 
      'user.delete', 
      'system.config', 
      'system.maintenance', 
      'finance.manage'
    ];
    return criticalActions.includes(action);
  };

  return {
    hasPermission,
    requiresApproval,
    role: profile?.role,
    isSuperAdmin: profile?.role === 'super_admin',
    isAdmin: profile?.role === 'admin' || profile?.role === 'super_admin',
    isModerator: profile?.role === 'moderator' || profile?.role === 'admin' || profile?.role === 'super_admin',
  };
};
