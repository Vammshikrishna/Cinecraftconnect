import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppRole, AppRole } from '@/hooks/useAppRole';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface RoleGuardProps {
  children: React.ReactNode;
  /** Minimum role required. super_admin > admin > moderator > user */
  requiredRole: AppRole;
  /** Where to redirect if role check fails */
  fallback?: string;
}

const ROLE_RANK: Record<AppRole, number> = {
  user: 0,
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
const RoleGuard = ({ children, requiredRole, fallback = '/feed' }: RoleGuardProps) => {
  const { role, loading } = useAppRole();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (ROLE_RANK[role] < ROLE_RANK[requiredRole]) {
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
};

export default RoleGuard;
