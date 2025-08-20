import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Index from '@/pages/Index';
import Feed from '@/pages/Feed';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const SmartHome = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Show loading spinner while checking auth state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Redirect authenticated users to feed if they're on landing page
  useEffect(() => {
    if (user && location.pathname === '/') {
      navigate('/feed', { replace: true });
    }
  }, [user, location.pathname, navigate]);

  // Show Feed directly for authenticated users, Index for non-authenticated
  return user ? <Feed /> : <Index />;
};

export default SmartHome;