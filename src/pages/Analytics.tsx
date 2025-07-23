import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EnhancedSkeleton, CardSkeleton } from '@/components/ui/enhanced-skeleton';
import { InteractiveCard } from '@/components/ui/interactive-card';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Calendar,
  Filter,
  Download,
  LucideIcon
} from 'lucide-react';

const Analytics = () => {
  const [timeRange, setTimeRange] = useState('7d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const analyticsData = [
    { name: 'Mon', views: 400, likes: 240, comments: 140, shares: 80 },
    { name: 'Tue', views: 300, likes: 139, comments: 221, shares: 90 },
    { name: 'Wed', views: 200, likes: 980, comments: 229, shares: 100 },
    { name: 'Thu', views: 278, likes: 390, comments: 200, shares: 110 },
    { name: 'Fri', views: 189, likes: 480, comments: 218, shares: 95 },
    { name: 'Sat', views: 239, likes: 380, comments: 250, shares: 120 },
    { name: 'Sun', views: 349, likes: 430, comments: 210, shares: 105 },
  ];

  const engagementData = [
    { name: 'Posts', value: 45, color: 'hsl(var(--primary))' },
    { name: 'Comments', value: 30, color: 'hsl(var(--secondary))' },
    { name: 'Likes', value: 15, color: 'hsl(var(--accent))' },
    { name: 'Shares', value: 10, color: 'hsl(var(--muted))' },
  ];

  const StatCard = ({ title, value, change, icon: Icon, trend }: {
    title: string;
    value: string;
    change: string;
    icon: LucideIcon;
    trend: 'up' | 'down';
  }) => (
    <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold animate-fade-in">{value}</p>
            <div className={cn(
              "flex items-center text-xs mt-1 transition-colors",
              trend === 'up' ? "text-green-500" : "text-red-500"
            )}>
              {trend === 'up' ? (
                <TrendingUp className="mr-1 h-3 w-3" />
              ) : (
                <TrendingDown className="mr-1 h-3 w-3" />
              )}
              {change}
            </div>
          </div>
          <div className={cn(
            "p-3 rounded-full transition-all duration-300 group-hover:scale-110",
            "bg-primary/10 text-primary group-hover:bg-primary/20"
          )}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <EnhancedSkeleton className="h-8 w-48 mb-2" />
              <EnhancedSkeleton className="h-4 w-64" />
            </div>
            <EnhancedSkeleton className="h-10 w-32" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CardSkeleton className="h-96" />
            <CardSkeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="container mx-auto px-4 py-8 animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 space-y-4 lg:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center">
              <TrendingUp className="mr-3 h-8 w-8 text-primary" />
              Analytics Dashboard
            </h1>
            <p className="text-muted-foreground">Track your performance and engagement metrics</p>
          </div>
          <div className="flex space-x-3">
            <Button variant="outline" className="hover-glow">
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
            <Button variant="outline" className="hover-glow">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Views"
            value="12,543"
            change="+12.5%"
            icon={Eye}
            trend="up"
          />
          <StatCard
            title="Engagement Rate"
            value="8.2%"
            change="+2.1%"
            icon={Heart}
            trend="up"
          />
          <StatCard
            title="New Followers"
            value="1,234"
            change="-3.2%"
            icon={Users}
            trend="down"
          />
          <StatCard
            title="Total Comments"
            value="2,847"
            change="+15.3%"
            icon={MessageCircle}
            trend="up"
          />
        </div>

        <Tabs value={timeRange} onValueChange={setTimeRange} className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
            <TabsList className="grid w-full sm:w-auto grid-cols-3 lg:grid-cols-4">
              <TabsTrigger value="7d" className="data-[state=active]:bg-primary">7 Days</TabsTrigger>
              <TabsTrigger value="30d" className="data-[state=active]:bg-primary">30 Days</TabsTrigger>
              <TabsTrigger value="90d" className="data-[state=active]:bg-primary">90 Days</TabsTrigger>
              <TabsTrigger value="1y" className="data-[state=active]:bg-primary">1 Year</TabsTrigger>
            </TabsList>
            <Badge variant="secondary" className="text-xs">
              <Calendar className="mr-1 h-3 w-3" />
              Last updated: 2 hours ago
            </Badge>
          </div>

          <TabsContent value={timeRange} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Enhanced Performance Chart */}
              <InteractiveCard
                title="Performance Overview"
                description="Views, likes, and comments over time"
                variant="hover-lift"
                className="h-96"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analyticsData}>
                    <defs>
                      <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="likesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
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
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px hsl(var(--primary) / 0.15)'
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="views"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#viewsGradient)"
                    />
                    <Area
                      type="monotone"
                      dataKey="likes"
                      stroke="hsl(var(--secondary))"
                      strokeWidth={2}
                      fill="url(#likesGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </InteractiveCard>

              {/* Enhanced Engagement Distribution */}
              <InteractiveCard
                title="Engagement Distribution"
                description="Breakdown of user interactions"
                variant="glow"
                className="h-96"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={engagementData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {engagementData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </InteractiveCard>
            </div>

            {/* Enhanced Detailed Metrics */}
            <InteractiveCard
              title="Detailed Metrics"
              description="Complete performance breakdown"
              variant="gradient"
            >
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analyticsData}>
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
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px hsl(var(--primary) / 0.15)'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="views" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={3}
                    dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="likes" 
                    stroke="hsl(var(--secondary))" 
                    strokeWidth={3}
                    dot={{ fill: 'hsl(var(--secondary))', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: 'hsl(var(--secondary))', strokeWidth: 2 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="comments" 
                    stroke="hsl(var(--accent))" 
                    strokeWidth={3}
                    dot={{ fill: 'hsl(var(--accent))', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: 'hsl(var(--accent))', strokeWidth: 2 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="shares" 
                    stroke="hsl(var(--muted-foreground))" 
                    strokeWidth={3}
                    dot={{ fill: 'hsl(var(--muted-foreground))', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: 'hsl(var(--muted-foreground))', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </InteractiveCard>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Analytics;