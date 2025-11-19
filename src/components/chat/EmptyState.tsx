import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    Icon: LucideIcon;
    title: string;
    message: string;
}

export const EmptyState = ({ Icon, title, message }: EmptyStateProps) => (
    <div className="text-center text-gray-500 mt-16">
        <Icon className="h-16 w-16 mx-auto mb-4 text-gray-600" />
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-2">{message}</p>
    </div>
);
