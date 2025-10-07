import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileSettings } from '@/components/settings/ProfileSettings';
import { PortfolioGrid } from '@/components/portfolio/PortfolioGrid';
import MovieRating from '@/components/MovieRating';
import { 
  User, 
  Briefcase, 
  TrendingUp, 
  Film 
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
  const [loading, setLoading] = useState(true);

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
    <div className="min-h-screen bg-background pt-20">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
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
            <TabsList className="grid w-full grid-cols-4 bg-card border border-border">
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
            </TabsList>

            <TabsContent value="profile">
              <ProfileSettings />
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
                  <PortfolioGrid />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center">
                    <TrendingUp className="mr-2 h-5 w-5" />
                    Profile Analytics
                  </CardTitle>
                  <CardDescription>
                    Track your profile performance and engagement
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="p-4 rounded-lg border border-border bg-background">
                      <p className="text-sm text-muted-foreground">Profile Views</p>
                      <p className="text-2xl font-bold text-foreground">2,543</p>
                      <p className="text-xs text-green-500">+12.5% this week</p>
                    </div>
                    <div className="p-4 rounded-lg border border-border bg-background">
                      <p className="text-sm text-muted-foreground">Portfolio Views</p>
                      <p className="text-2xl font-bold text-foreground">1,234</p>
                      <p className="text-xs text-green-500">+8.2% this week</p>
                    </div>
                    <div className="p-4 rounded-lg border border-border bg-background">
                      <p className="text-sm text-muted-foreground">Connections</p>
                      <p className="text-2xl font-bold text-foreground">456</p>
                      <p className="text-xs text-green-500">+5.1% this week</p>
                    </div>
                  </div>
                  
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analyticsData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="name" 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Bar dataKey="views" fill="hsl(var(--primary))" />
                      <Bar dataKey="likes" fill="hsl(var(--secondary))" />
                    </BarChart>
                  </ResponsiveContainer>
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
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Profile;
