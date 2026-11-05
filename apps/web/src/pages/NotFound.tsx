import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Home, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BackButton } from '@/components/common/BackButton';

const NotFound = () => {
  const { user } = useAuth();
  // signed in: the feed; signed out: the public landing page (the feed would bounce to sign-in)
  const exploreTo = user ? '/feed' : '/';

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center glass-card">
        <CardContent className="pt-6">
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-6xl font-bold text-primary">404</h1>
              <h2 className="text-2xl font-semibold">Page Not Found</h2>
              <p className="text-muted-foreground">
                The page you're looking for doesn't exist or has been moved.
              </p>
            </div>
            
            <div className="space-y-3">
              <Button asChild className="w-full">
                <Link to="/">
                  <Home className="h-4 w-4 mr-2" />
                  Go Home
                </Link>
              </Button>
              
              <Button variant="outline" asChild className="w-full">
                <Link to={exploreTo}>
                  <Search className="h-4 w-4 mr-2" />
                  {user ? 'Open my feed' : 'Explore'}
                </Link>
              </Button>
              
              <BackButton className="w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;
