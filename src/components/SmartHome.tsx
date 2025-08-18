import { useAuth } from '@/contexts/AuthContext';
import Index from '@/pages/Index';
import Feed from '@/pages/Feed';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const SmartHome = () => {
  const { user, isLoading } = useAuth();

  // Show loading spinner while checking auth state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Show Feed directly for authenticated users, Index for non-authenticated
  return user ? <Feed /> : <Index />;
};

export default SmartHome;