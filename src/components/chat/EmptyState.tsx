import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface EmptyStateProps {
    Icon?: LucideIcon;
    title?: string;
    message?: string;
    action?: ReactNode;
}

export const EmptyState = ({ Icon, title, message, action }: EmptyStateProps) => {
    return (
        <div className="flex flex-col items-center justify-center h-full w-full p-8 text-center animate-fade-in">
            {Icon && (
                <div className="bg-primary/10 p-6 rounded-full mb-6">
                    <Icon className="h-12 w-12 text-primary" />
                </div>
            )}
            {title && <h3 className="text-2xl font-bold mb-2">{title}</h3>}
            {message && (
                <p className="text-muted-foreground max-w-md mb-6">
                    {message}
                </p>
            )}
            {action}
        </div>
    );
};
