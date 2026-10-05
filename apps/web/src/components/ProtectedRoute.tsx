
import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, isLoading, profile } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Redirect to auth page if not authenticated
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Redirect to profile completion if onboarding not completed
  // Allow access to complete-profile and auth pages
  // Bypass for internal users (staff)
  const isInternal = profile?.is_internal || (profile?.role && ['admin', 'moderator', 'super_admin'].includes(profile.role));
  
  if (profile && !isInternal && !profile.onboarding_completed && location.pathname !== '/complete-profile') {
    return <Navigate to="/complete-profile" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
