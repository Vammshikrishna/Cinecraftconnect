
import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { onboardingGateDecision } from "@/components/onboardingGate";
import ForcePasswordChange from "@/components/auth/ForcePasswordChange";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, isLoading, profile, profileLoadFailed, retryProfile, signOut } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const decision = onboardingGateDecision({ hasSession: !!user, profile, profileLoadFailed });
  const onOnboardingPage = location.pathname === '/complete-profile';

  if (decision === 'signin') {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Until the profile is known we cannot tell whether onboarding is finished, so no page renders (there is no timeout that lets
  // the app through: a failed load shows a retry state instead).
  if (decision === 'wait') {
    if (onOnboardingPage) return <>{children}</>;
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (decision === 'retry') {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-semibold">Could not load your profile</h1>
        <p className="text-muted-foreground max-w-sm">Check your connection and try again.</p>
        <div className="flex gap-3">
          <Button onClick={() => retryProfile()}>Try again</Button>
          <Button variant="outline" onClick={() => signOut()}>Sign out</Button>
        </div>
      </div>
    );
  }

  // A required password change comes before every page and console, for staff only (new staff accounts, or a reset by a super admin).
  // Fan, creator and studio accounts never see this screen.
  const p = profile as any;
  const isStaffAccount = !!p?.is_internal || ['admin', 'moderator', 'super_admin', 'finance'].includes(p?.role);
  if (isStaffAccount && p?.force_password_reset === true) {
    return <ForcePasswordChange />;
  }

  // Unfinished onboarding: always back to /complete-profile, from any route (staff are bypassed by the decision)
  if (decision === 'onboarding' && !onOnboardingPage) {
    return <Navigate to="/complete-profile" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
