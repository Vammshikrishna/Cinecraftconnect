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
        <div id="create-post-widget" className="mb-3.5 sm:mb-4 px-0 sm:px-0">
            <Button
                id="create-post-trigger"
                onClick={() => navigate('/create')}
                className="w-full justify-start text-left bg-card/60 hover:bg-card/90 border border-border/50 hover:border-primary/40 h-11 text-sm rounded-xl px-3.5 shadow-sm transition-all group"
                variant="ghost"
            >
                <div className="p-1.5 rounded-full bg-primary/10 text-primary mr-2.5 group-hover:scale-110 transition-transform">
                    <PlusCircle className="h-4 w-4 shrink-0" />
                </div>
                <span className="hidden sm:inline text-muted-foreground group-hover:text-foreground transition-colors font-medium">Share your latest project or idea...</span>
                <span className="inline sm:hidden text-muted-foreground group-hover:text-foreground transition-colors font-medium">Create a post...</span>
            </Button>
        </div>
    );
}
