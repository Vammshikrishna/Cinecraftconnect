import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppRole, AppRole } from '@/hooks/useAppRole';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from '@/hooks/use-toast';

interface RoleGuardProps {
  children: React.ReactNode;
  /** Minimum role required. super_admin > admin > moderator > user */
  requiredRole: AppRole;
  /** Where to redirect if role check fails */
  fallback?: string;
  /** Exact roles allowed (instead of a minimum rank), for a console that is not on the moderator > admin > super admin ladder, like finance */
  onlyRoles?: AppRole[];
}

const ROLE_RANK: Record<AppRole, number> = {
  user: 0,
  finance: 0.5,
  moderator: 1,
  admin: 2,
  super_admin: 3,
};

/**
 * RoleGuard — wraps routes that require a minimum platform governance role.
 *
 * Usage:
 *   <RoleGuard requiredRole="moderator"><ModerationDashboard /></RoleGuard>
 *   <RoleGuard requiredRole="admin"><AdminDashboard /></RoleGuard>
 *   <RoleGuard requiredRole="super_admin"><SuperAdminDashboard /></RoleGuard>
 */
const RoleGuard = ({ children, requiredRole, fallback = '/feed', onlyRoles }: RoleGuardProps) => {
  const { role, loading } = useAppRole();
  const denied = !loading && (onlyRoles ? !onlyRoles.includes(role) : ROLE_RANK[role] < ROLE_RANK[requiredRole]);

  // tell staff why they were sent away (a silent redirect looks like a bug). Done in an effect, never during render.
  useEffect(() => {
    if (denied && role !== 'user') {
      toast({ title: 'That console is above your role', description: `This page needs the ${requiredRole.replace('_', ' ')} role. You can use the consoles for your own role.` });
    }
  }, [denied, role, requiredRole]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (denied) {
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
};

export default RoleGuard;
