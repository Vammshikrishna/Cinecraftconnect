import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppRole } from '@/hooks/useAppRole';

interface CreatePostWidgetProps {
    onPostCreated?: () => void;
    defaultExpanded?: boolean;
    defaultPageId?: string;
}

export function CreatePostWidget({ defaultPageId = "user" }: CreatePostWidgetProps) {
    const navigate = useNavigate();
    const { isInternal } = useAppRole();

    if (isInternal) return null;

    return (
        <Card className="glass-card p-2 mb-6 rounded-none sm:rounded-xl border-x-0 sm:border-x border-y" id="create-post-widget">
            <Button
                id="create-post-trigger"
                onClick={() => navigate('/create')}
                className="w-full justify-start text-left bg-transparent hover:bg-accent border-dashed border-2 border-border h-10 text-sm"
                variant="outline"
            >
                <PlusCircle className="mr-2 h-5 w-5 shrink-0" />
                <span className="hidden sm:inline">Share your latest project or idea...</span>
                <span className="inline sm:hidden">Create a post...</span>
            </Button>
        </Card>
    );
}
