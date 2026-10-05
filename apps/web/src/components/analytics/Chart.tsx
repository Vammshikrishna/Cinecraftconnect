import { ResponsiveContainer, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, Area, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { ChartData, EngagementData } from '@/types/analytics';

interface ChartProps {
    data: ChartData[];
    type: 'area' | 'pie' | 'line';
    config?: any;
}

export const Chart = ({ data, type, config }: ChartProps) => {
    // Basic safety check
    if (type !== 'pie' && (!data || data.length === 0)) {
        return (
            <div className="flex items-center justify-center h-full w-full bg-muted/10 rounded-xl text-muted-foreground text-xs italic">
                No data available for this period
            </div>
        );
    }

    switch (type) {
        case 'area':
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                            itemStyle={{ fontSize: '12px' }}
                        />
                        <Area type="monotone" dataKey="views" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#viewsGradient)" />
                        <Area type="monotone" dataKey="likes" stroke="hsl(var(--secondary))" strokeWidth={2} fill="url(#likesGradient)" />
                    </AreaChart>
                </ResponsiveContainer>
            );
        case 'pie':
            const pieData = config?.data || [];
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                        <Pie 
                            data={pieData} 
                            dataKey="value" 
                            nameKey="name" 
                            cx="50%" 
                            cy="50%" 
                            outerRadius={65} 
                            innerRadius={45}
                            paddingAngle={5}
                            labelLine={false} 
                            label={({ name, percent, x, y, cx }) => (
                                <text
                                    x={x}
                                    y={y}
                                    fill="#ffffff"
                                    textAnchor={x > cx ? 'start' : 'end'}
                                    dominantBaseline="central"
                                    fontSize={11}
                                    fontWeight="bold"
                                >
                                    {`${name}: ${(percent * 100).toFixed(0)}%`}
                                </text>
                            )}
                        >
                            {(pieData.map((entry: EngagementData, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            )) as any)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    </PieChart>
                </ResponsiveContainer>
            );
        case 'line':
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                        {(config || []).map((line: any) => (
                            <Line key={line.key} type="monotone" dataKey={line.key} stroke={line.color} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: 'hsl(var(--background))' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            );
        default:
            return null;
    }
};
