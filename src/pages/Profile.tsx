import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileSettings } from '@/components/settings/ProfileSettings';
import { PortfolioGrid } from '@/components/portfolio/PortfolioGrid';
import PortfolioUploadDialog from '@/components/portfolio/PortfolioUploadDialog';
import MovieRating from '@/components/MovieRating';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { PrivacySettings } from '@/components/settings/PrivacySettings';
import { UserPosts } from '@/components/profile/UserPosts';
import { UserProjects } from '@/components/profile/UserProjects';
import { UserAnnouncements } from '@/components/profile/UserAnnouncements';
import { RealTimeAnalytics } from '@/components/profile/RealTimeAnalytics';
import { useAuth } from '@/contexts/AuthContext';
import { 
  User, 
  Briefcase, 
  TrendingUp, 
  Film,
  Settings
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const Profile = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [portfolioDialogOpen, setPortfolioDialogOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const analyticsData = [
    { name: 'Mon', views: 400, likes: 240 },
    { name: 'Tue', views: 300, likes: 139 },
    { name: 'Wed', views: 200, likes: 980 },
    { name: 'Thu', views: 278, likes: 390 },
    { name: 'Fri', views: 189, likes: 480 },
    { name: 'Sat', views: 239, likes: 380 },
    { name: 'Sun', views: 349, likes: 430 },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-24 pb-16">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center">
              <User className="mr-3 h-8 w-8" />
              My Profile
            </h1>
            <p className="text-muted-foreground">
              Manage your public profile, portfolio, and analytics
            </p>
          </div>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5 bg-card border border-border">
              <TabsTrigger 
                value="profile" 
                className="flex items-center data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <User className="mr-2 h-4 w-4" />
                Profile
              </TabsTrigger>
              <TabsTrigger 
                value="portfolio"
                className="flex items-center data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Briefcase className="mr-2 h-4 w-4" />
                Portfolio
              </TabsTrigger>
              <TabsTrigger 
                value="analytics"
                className="flex items-center data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                Analytics
              </TabsTrigger>
              <TabsTrigger 
                value="ratings"
                className="flex items-center data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Film className="mr-2 h-4 w-4" />
                Watchlist & Ratings
              </TabsTrigger>
              <TabsTrigger 
                value="settings"
                className="flex items-center data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-6">
              <ProfileSettings />
              
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">My Posts</h3>
                <UserPosts />
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-semibold">My Projects</h3>
                <UserProjects />
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-semibold">My Announcements</h3>
                <UserAnnouncements />
              </div>
            </TabsContent>

            <TabsContent value="portfolio">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center">
                    <Briefcase className="mr-2 h-5 w-5" />
                    My Portfolio
                  </CardTitle>
                  <CardDescription>
                    Showcase your best work and projects
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PortfolioGrid 
                    userId={user?.id} 
                    isOwner={true} 
                    onAddNew={() => setPortfolioDialogOpen(true)}
                  />
                  <PortfolioUploadDialog
                    isOpen={portfolioDialogOpen}
                    onOpenChange={setPortfolioDialogOpen}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center">
                    <TrendingUp className="mr-2 h-5 w-5" />
                    Real-Time Analytics
                  </CardTitle>
                  <CardDescription>
                    Track your profile performance and engagement in real-time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RealTimeAnalytics />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ratings">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center">
                    <Film className="mr-2 h-5 w-5" />
                    Watchlist & Ratings
                  </CardTitle>
                  <CardDescription>
                    Rate and review films you've watched
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <MovieRating 
                    title="The Shawshank Redemption"
                    rating={5}
                    releaseDate="1994"
                    type="Movie"
                  />
                  <MovieRating 
                    title="The Godfather"
                    rating={5}
                    releaseDate="1972"
                    type="Movie"
                  />
                  <MovieRating 
                    title="Inception"
                    rating={4}
                    releaseDate="2010"
                    type="Movie"
                  />
                  <div className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      Rate more films to build your watchlist
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              <AccountSettings />
              <NotificationSettings />
              <PrivacySettings />
            </TabsContent>
          </Tabs>
      </div>
    </div>
  );
};

export default Profile;
