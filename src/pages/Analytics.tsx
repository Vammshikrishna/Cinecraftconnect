import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InteractiveCard } from '@/components/ui/interactive-card';
import { timeRanges, statCards, analyticsData, engagementData } from '@/data/analytics';
import { Chart } from '@/components/analytics/Chart';
import { StatCard } from '@/components/analytics/StatCard';
import { ChartConfig } from '@/types/analytics';
import { TrendingUp, Filter, Download, Calendar } from 'lucide-react';

const detailedChartConfig: ChartConfig[] = [
    { key: 'views', label: 'Views', color: 'hsl(var(--primary))' },
    { key: 'likes', label: 'Likes', color: 'hsl(var(--secondary))' },
    { key: 'comments', label: 'Comments', color: 'hsl(var(--accent))' },
    { key: 'shares', label: 'Shares', color: 'hsl(var(--muted-foreground))' },
];

const AnalyticsSkeleton = () => (
    <div className="min-h-screen bg-background pt-20">
        <div className="container mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <div className="h-8 w-48 mb-2 bg-gray-700/50 rounded animate-pulse" />
                    <div className="h-4 w-64 bg-gray-700/50 rounded animate-pulse" />
                </div>
                <div className="h-10 w-32 bg-gray-700/50 rounded animate-pulse" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-32 bg-gray-800/50 rounded-lg animate-pulse" />
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-96 bg-gray-800/50 rounded-lg animate-pulse" />
                <div className="h-96 bg-gray-800/50 rounded-lg animate-pulse" />
            </div>
        </div>
    </div>
);

const Analytics = () => {
    const [timeRange, setTimeRange] = useState('7d');
    const [loading, setLoading] = useState(true);
    const [currentData, setCurrentData] = useState(analyticsData['7d']);

    useEffect(() => {
        setLoading(true);
        const timer = setTimeout(() => {
            setCurrentData(analyticsData[timeRange]);
            setLoading(false);
        }, 500);
        return () => clearTimeout(timer);
    }, [timeRange]);

    if (loading) {
        return <AnalyticsSkeleton />;
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {statCards.map((card, index) => <StatCard key={index} {...card} />)}
                </div>

                <Tabs value={timeRange} onValueChange={setTimeRange} className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
                        <TabsList className="grid w-full sm:w-auto grid-cols-2 lg:grid-cols-4">
                            {timeRanges.map(range => (
                                <TabsTrigger key={range.value} value={range.value} className="data-[state=active]:bg-primary">{range.label}</TabsTrigger>
                            ))}
                        </TabsList>
                        <Badge variant="secondary" className="text-xs">
                            <Calendar className="mr-1 h-3 w-3" />
                            Last updated: 2 hours ago
                        </Badge>
                    </div>

                    <TabsContent value={timeRange} className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <InteractiveCard title="Performance Overview" description="Views, likes, and comments over time" variant="hover-lift" className="h-96">
                                <Chart data={currentData} type="area" />
                            </InteractiveCard>
                            <InteractiveCard title="Engagement Distribution" description="Breakdown of user interactions" variant="glow" className="h-96">
                                <Chart data={currentData} type="pie" config={{ data: engagementData }} />
                            </InteractiveCard>
                        </div>
                        <InteractiveCard title="Detailed Metrics" description="Complete performance breakdown" variant="gradient">
                            <Chart data={currentData} type="line" config={detailedChartConfig} />
                        </InteractiveCard>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};

export default Analytics;
