import React from 'react';
import { useRealtimeData } from '@/lib/realtime';

interface Budget {
    id: number;
    total_budget: number;
    spent: number;
}

interface Schedule {
    id: number;
    pre_production_start: string;
    pre_production_end: string;
    production_start: string;
    production_end: string;
    post_production_start: string;
    post_production_end: string;
}

// CORRECTED: Props interface now expects project_id
interface BudgetSchedProps {
    project_id: string;
}

// CORRECTED: Component now accepts project_id
const BudgetSched = ({ project_id }: BudgetSchedProps) => {
    // CORRECTED: useRealtimeData hooks are now called with project_id
    const { data: budgetData, error: budgetError } = useRealtimeData<Budget>('budgets', project_id);
    const { data: scheduleData, error: scheduleError } = useRealtimeData<Schedule>('schedules', project_id);

    if (budgetError || scheduleError) {
        return <div className="p-8 text-destructive">Error loading data: {budgetError?.message || scheduleError?.message}</div>;
    }

    // Use the first item in the array, if it exists
    const budget = budgetData ? budgetData[0] : null;
    const schedule = scheduleData ? scheduleData[0] : null;

    const formatDateRange = (start: string, end: string) => {
        const startDate = new Date(start).toLocaleDateString();
        const endDate = new Date(end).toLocaleDateString();
        return `${startDate} - ${endDate}`;
    }

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-6">Budget & Schedule</h1>
            <div className="space-y-8">
                <div className="bg-slate-800/50 p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold border-b border-slate-700 pb-2 mb-4">Budget Overview</h2>
                    {budget ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <p><strong className="text-muted-foreground">Total Budget:</strong> ${budget.total_budget.toLocaleString()}</p>
                            <p><strong className="text-muted-foreground">Spent:</strong> ${budget.spent.toLocaleString()}</p>
                            <p><strong className="text-muted-foreground">Remaining:</strong> ${(budget.total_budget - budget.spent).toLocaleString()}</p>
                        </div>
                    ) : (
                        <p className="text-muted-foreground">No budget information available.</p>
                    )}
                </div>
                <div className="bg-slate-800/50 p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold border-b border-slate-700 pb-2 mb-4">Schedule Overview</h2>
                    {schedule ? (
                        <div className="space-y-3">
                            <p><strong className="text-muted-foreground w-32 inline-block">Pre-production:</strong> {formatDateRange(schedule.pre_production_start, schedule.pre_production_end)}</p>
                            <p><strong className="text-muted-foreground w-32 inline-block">Production:</strong> {formatDateRange(schedule.production_start, schedule.production_end)}</p>
                            <p><strong className="text-muted-foreground w-32 inline-block">Post-production:</strong> {formatDateRange(schedule.post_production_start, schedule.post_production_end)}</p>
                        </div>
                    ) : (
                        <p className="text-muted-foreground">No schedule information available.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BudgetSched;
