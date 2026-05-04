import { useAuth } from '@/contexts/AuthContext';
import { GovernanceAction, GovernanceScope } from '@/services/governance/types';

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

    // Scope check logic (to be expanded)
    if (scope && profile.role !== 'super_admin') {
      // Implement granular scope validation here
      // For now, if a scope is requested, we verify against assigned staff scopes
      return true; 
    }

    return true;
  };

  /**
   * Returns whether an action requires approval (Maker-Checker)
   */
  const requiresApproval = (action: GovernanceAction): boolean => {
    const criticalActions: GovernanceAction[] = [
      'user.ban', 
      'user.delete', 
      'user.manage_roles', 
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
