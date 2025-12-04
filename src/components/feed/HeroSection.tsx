import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Plus, Film, MessageSquare, Briefcase } from 'lucide-react';
import { Link } from 'react-router-dom';

const HeroSection = () => {
    const { user } = useAuth();

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    };

    const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'Creator';

    return (
        <div className="px-4 py-6 space-y-6">
            <div className="space-y-1">
                <h1 className="text-3xl font-extrabold tracking-tight">
                    {getGreeting()}, <span className="text-primary">{firstName}</span>
                </h1>
                <p className="text-muted-foreground">
                    Ready to create something amazing today?
                </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Button asChild variant="outline" className="h-auto py-4 flex flex-col gap-2 border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-all">
                    <Link to="/projects/new">
                        <Film className="h-6 w-6 text-primary" />
                        <span className="font-semibold">New Project</span>
                    </Link>
                </Button>

                <Button asChild variant="outline" className="h-auto py-4 flex flex-col gap-2 border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-all">
                    <Link to="/discussion-rooms/new">
                        <MessageSquare className="h-6 w-6 text-blue-500" />
                        <span className="font-semibold">Start Discussion</span>
                    </Link>
                </Button>

                <Button asChild variant="outline" className="h-auto py-4 flex flex-col gap-2 border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-all">
                    <Link to="/jobs/new">
                        <Briefcase className="h-6 w-6 text-green-500" />
                        <span className="font-semibold">Post Job</span>
                    </Link>
                </Button>

                <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-all" onClick={() => document.getElementById('create-post-trigger')?.click()}>
                    <Plus className="h-6 w-6 text-purple-500" />
                    <span className="font-semibold">Create Post</span>
                </Button>
            </div>
        </div>
    );
};

export default HeroSection;
