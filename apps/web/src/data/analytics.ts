import { ChartData, EngagementData, StatCardData } from "@/types/analytics";
import { Eye, Heart, Users, MessageCircle } from 'lucide-react';

export const timeRanges = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: '1y', label: '1 Year' },
];

export const statCards: StatCardData[] = [
  {
    title: "Total Views",
    value: "12,543",
    change: "+12.5%",
    icon: Eye,
    trend: "up",
  },
  {
    title: "Engagement Rate",
    value: "8.2%",
    change: "+2.1%",
    icon: Heart,
    trend: "up",
  },
  {
    title: "New Followers",
    value: "1,234",
    change: "-3.2%",
    icon: Users,
    trend: "down",
  },
  {
    title: "Total Comments",
    value: "2,847",
    change: "+15.3%",
    icon: MessageCircle,
    trend: "up",
  },
];

const generateChartData = (days: number): ChartData[] => {
    return [...Array(days)].map((_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (days - i - 1));
        return {
            name: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            views: Math.floor(Math.random() * 500) + 200,
            likes: Math.floor(Math.random() * 300) + 100,
            comments: Math.floor(Math.random() * 150) + 50,
            shares: Math.floor(Math.random() * 80) + 20,
        };
    });
};

export const analyticsData: { [key: string]: ChartData[] } = {
  '7d': generateChartData(7),
  '30d': generateChartData(30),
  '90d': generateChartData(90),
  '1y': generateChartData(365),
};

export const engagementData: EngagementData[] = [
  { name: 'Posts', value: 45, color: 'hsl(var(--primary))' },
  { name: 'Comments', value: 30, color: 'hsl(var(--secondary))' },
  { name: 'Likes', value: 15, color: 'hsl(var(--accent))' },
  { name: 'Shares', value: 10, color: 'hsl(var(--muted))' },
];
