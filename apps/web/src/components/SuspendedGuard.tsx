import { useAuth } from "@/contexts/AuthContext";
import { SuspendedPage } from "@/pages/Suspended";

export const SuspendedGuard = ({ children }: { children: React.ReactNode }) => {
  const { profile, isLoading } = useAuth();

  if (isLoading) return null;

  if (profile?.is_banned) {
    return <SuspendedPage />;
  }

  return <>{children}</>;
};
