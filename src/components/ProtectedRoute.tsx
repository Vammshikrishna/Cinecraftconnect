
import React from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

// Modified to always render children without authentication checks
const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  return <>{children}</>;
};

export default ProtectedRoute;
