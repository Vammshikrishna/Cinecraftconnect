import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { useEffect } from 'react';
import Index from '@/pages/Index';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const SmartHome = () => {
  const { user, isLoading } = useAuth();
  const { push } = useAppNavigation();
  const location = useLocation();

  // Redirect authenticated users to feed if they're on landing page
  useEffect(() => {
    if (user && location.pathname === '/') {
      push('/feed', { noScroll: true });
    }
  }, [user, location.pathname, push]);

  // Show loading spinner while checking auth state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Only show Index page to non-authenticated users
  if (user) {
    // Show loading while redirect happens for authenticated users
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return <Index />;
};

export default SmartHome;