import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface EmptyStateProps {
    Icon: LucideIcon;
    title: string;
    message: string;
    action?: ReactNode;
}

export const EmptyState = ({ Icon, title, message, action }: EmptyStateProps) => (
    <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
            <Icon className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">{title}</h2>
        <p className="text-muted-foreground max-w-md mx-auto">{message}</p>
        {action && <div className="mt-6">{action}</div>}
    </div>
);
