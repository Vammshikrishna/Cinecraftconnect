import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string;
    change: string;
    icon: LucideIcon;
    trend: 'up' | 'down';
}

export const StatCard = ({ title, value, change, icon: Icon, trend }: StatCardProps) => (
    <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
        <CardContent className="p-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    <p className="text-2xl font-bold animate-fade-in">{value}</p>
                    <div className={cn("flex items-center text-xs mt-1", trend === 'up' ? "text-green-500" : "text-red-500")}>
                        {trend === 'up' ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}
                        {change}
                    </div>
                </div>
                <div className={cn("p-3 rounded-full transition-all duration-300 group-hover:scale-110", "bg-primary/10 text-primary group-hover:bg-primary/20")}>
                    <Icon className="h-6 w-6" />
                </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
        </CardContent>
    </Card>
);
