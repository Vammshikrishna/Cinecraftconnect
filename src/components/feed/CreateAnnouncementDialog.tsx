import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface CreateAnnouncementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAnnouncementCreated: () => void;
}

export const CreateAnnouncementDialog = ({
    open,
    onOpenChange,
    onAnnouncementCreated
}: CreateAnnouncementDialogProps) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        if (!title.trim() || !content.trim()) {
            toast({
                title: "Validation Error",
                description: "Title and content are required.",
                variant: "destructive"
            });
            return;
        }

        setIsLoading(true);

        try {
            const { error } = await supabase
                .from('announcements')
                .insert({
                    title: title.trim(),
                    content: content.trim(),
                    author_id: user.id,
                    posted_at: new Date().toISOString()
                });

            if (error) throw error;

            toast({
                title: "Success",
                description: "Announcement created successfully."
            });

            setTitle('');
            setContent('');
            onAnnouncementCreated();
            onOpenChange(false);

        } catch (error) {
            console.error('Error creating announcement:', error);
            toast({
                title: "Error",
                description: "Failed to create announcement.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Create Announcement</DialogTitle>
                    <DialogDescription>
                        Share an update with the community.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Title</Label>
                        <Input
                            id="title"
                            placeholder="Announcement Title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="content">Content</Label>
                        <Textarea
                            id="content"
                            placeholder="Write your announcement details here..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="min-h-[150px]"
                            disabled={isLoading}
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Post Announcement
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
