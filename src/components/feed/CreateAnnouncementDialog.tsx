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
import { MentionTextarea } from '@/components/ui/mention-textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User } from 'lucide-react';
import { useMyPages } from '@/hooks/useCompanyPages';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
    const [mentionedIds, setMentionedIds] = useState<Set<string>>(new Set());
    const [selectedPageId, setSelectedPageId] = useState<string>('personal');
    
    const { data: myPages = [] } = useMyPages();

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
            const { data: announcementData, error } = await supabase
                .from('announcements')
                .insert({
                    title: title.trim(),
                    content: content.trim(),
                    author_id: user.id,
                    publisher_page_id: selectedPageId === 'personal' ? null : selectedPageId,
                    posted_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;

            // Handle Mentions Persistence for Announcements
            if (mentionedIds.size > 0 && announcementData) {
              const mentionsToInsert = Array.from(mentionedIds).map(mentionedId => ({
                mentioner_id: user.id,
                mentioned_id: mentionedId,
                related_id: announcementData.id,
                related_type: 'announcement'
              }));
              
              await supabase.from('mentions' as any).insert(mentionsToInsert as any);
            }

            toast({
                title: "Success",
                description: "Announcement created successfully."
            });

            setTitle('');
            setContent('');
            setMentionedIds(new Set());
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

                <form onSubmit={handleSubmit} className="space-y-6 pt-4">
                    {myPages.length > 0 && (
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold opacity-70">Post as...</Label>
                            <Select value={selectedPageId} onValueChange={setSelectedPageId}>
                                <SelectTrigger className="w-full h-14 bg-background/50 border-border/50">
                                    <SelectValue placeholder="Choose identity" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="personal" className="py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-primary/10 rounded-lg">
                                                <User className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="flex flex-col items-start">
                                                <span className="font-semibold text-sm">Personal Profile</span>
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Default</span>
                                            </div>
                                        </div>
                                    </SelectItem>
                                    {myPages.map(page => (
                                        <SelectItem key={page.id} value={page.id} className="py-3">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8 border border-border">
                                                    <AvatarImage src={page.logo_url || undefined} />
                                                    <AvatarFallback>{page.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col items-start">
                                                    <span className="font-semibold text-sm">{page.name}</span>
                                                    <span className="text-[10px] text-primary uppercase tracking-wider font-bold">Company Page</span>
                                                </div>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="title" className="text-sm font-semibold opacity-70">Headline</Label>
                        <Input
                            id="title"
                            placeholder="What's the big news?"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="h-12 bg-background/50 border-border/50 focus:ring-primary/20"
                            disabled={isLoading}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="content">Content</Label>
                        <MentionTextarea
                            id="content"
                            placeholder="Write your announcement details here..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            onMentionSelected={(user) => setMentionedIds(prev => new Set(prev).add(user.id))}
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
