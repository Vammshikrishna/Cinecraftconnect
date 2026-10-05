import { useState, useEffect } from 'react';
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
import { useAppRole } from '@/hooks/useAppRole';
import { Switch } from '@/components/ui/switch';
import { STORAGE_BUCKETS, buildUserFilePath } from '@/lib/storage';
import { ANNOUNCEMENT_CATEGORIES, type AnnouncementRow } from '@/components/announcements/AnnouncementItem';
import { ImagePlus, X } from 'lucide-react';

interface CreateAnnouncementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAnnouncementCreated: () => void;
    /** Edit an existing announcement instead of creating one. */
    editing?: AnnouncementRow | null;
    /** Start with this company page selected. */
    defaultPageId?: string | null;
}

export const CreateAnnouncementDialog = ({
    open,
    onOpenChange,
    onAnnouncementCreated,
    editing = null,
    defaultPageId = null
}: CreateAnnouncementDialogProps) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const { isInternal } = useAppRole();
    const [isLoading, setIsLoading] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [mentionedIds, setMentionedIds] = useState<Set<string>>(new Set());
    const [selectedPageId, setSelectedPageId] = useState<string>('personal');
    const [category, setCategory] = useState('general');
    const [audience, setAudience] = useState<'everyone' | 'followers' | 'team'>('everyone');
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [publishAt, setPublishAt] = useState('');
    const [endsOn, setEndsOn] = useState('');
    const [pinned, setPinned] = useState(false);

    // load the announcement being edited / the preset page each time the dialog opens
    useEffect(() => {
        if (!open) return;
        if (editing) {
            setTitle(editing.title);
            setContent(editing.content.includes('JOB_SHARE::') ? editing.content.split('JOB_SHARE::')[0].trim() : editing.content);
            setCategory(editing.category || 'general');
            setAudience(editing.audience || 'everyone');
            setImageUrl(editing.image_url || null);
            setEndsOn(editing.expires_at ? editing.expires_at.slice(0, 10) : '');
            setPinned(!!editing.is_pinned);
            setPublishAt('');
            setSelectedPageId(editing.publisher_page_id || 'personal');
        } else if (defaultPageId) {
            setSelectedPageId(defaultPageId);
        }
    }, [open, editing?.id, defaultPageId]);

    const uploadCover = async (file: File | null) => {
        if (!file || !user) return;
        if (!file.type.startsWith('image/')) return toast({ title: 'Pick an image', variant: 'destructive' });
        setUploading(true);
        try {
            const { compressImage } = await import('@/utils/imageCompression');
            const small = await compressImage(file);
            const path = buildUserFilePath(`announcements/${user.id}`, `cover-${Date.now()}.${small.name.split('.').pop()}`);
            const { error } = await supabase.storage.from(STORAGE_BUCKETS.AVATARS).upload(path, small, { cacheControl: '31536000', upsert: false });
            if (error) throw error;
            setImageUrl(supabase.storage.from(STORAGE_BUCKETS.AVATARS).getPublicUrl(path).data.publicUrl);
        } catch (e: any) {
            toast({ title: 'Could not upload the image', description: e?.message, variant: 'destructive' });
        } finally {
            setUploading(false);
        }
    };
    
    const { data: myPages = [] } = useMyPages();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || isInternal) return;

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
            if (editing) {
                // keep a shared job card (the marker after the text) when the text is edited
                const marker = editing.content.includes('JOB_SHARE::') ? '\n\nJOB_SHARE::' + editing.content.split('JOB_SHARE::').pop() : '';
                const { error: upErr } = await (supabase as any).from('announcements').update({
                    title: title.trim(),
                    content: content.trim() + marker,
                    category,
                    audience: selectedPageId === 'personal' && audience === 'team' ? 'everyone' : audience,
                    image_url: imageUrl,
                    expires_at: endsOn ? new Date(`${endsOn}T23:59:00`).toISOString() : null,
                    is_pinned: pinned,
                    ...(editing.scheduled && publishAt ? { posted_at: new Date(publishAt).toISOString() } : {})
                }).eq('id', editing.id);
                if (upErr) throw upErr;
                toast({ title: 'Announcement updated' });
                onAnnouncementCreated();
                onOpenChange(false);
                return;
            }
            const { data: announcementData, error } = await supabase
                .from('announcements')
                .insert({
                    title: title.trim(),
                    content: content.trim(),
                    author_id: user.id,
                    publisher_page_id: selectedPageId === 'personal' ? null : selectedPageId,
                    posted_at: publishAt ? new Date(publishAt).toISOString() : new Date().toISOString(),
                    category,
                    audience: selectedPageId === 'personal' && audience === 'team' ? 'everyone' : audience,
                    image_url: imageUrl,
                    expires_at: endsOn ? new Date(`${endsOn}T23:59:00`).toISOString() : null,
                    is_pinned: pinned
                } as any)
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
            setCategory('general');
            setAudience('everyone');
            setImageUrl(null);
            setPublishAt('');
            setEndsOn('');
            setPinned(false);
            setMentionedIds(new Set());
            onAnnouncementCreated();
            onOpenChange(false);

        } catch (error: any) {
            console.error('Error creating announcement:', error);
            toast({
                title: "Error",
                description: error?.message || "Failed to create announcement.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{editing ? 'Edit Announcement' : 'Create Announcement'}</DialogTitle>
                    <DialogDescription>
                        {isInternal 
                          ? "Internal staff accounts are restricted from publishing public announcements."
                          : "Share an update with the community."}
                    </DialogDescription>
                </DialogHeader>

                {isInternal ? (
                    <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
                        <div className="p-4 bg-muted rounded-full">
                            <Loader2 className="h-8 w-8 text-muted-foreground opacity-20" />
                        </div>
                        <p className="text-sm text-muted-foreground italic">
                            Your account is in moderation-only mode.
                        </p>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6 pt-4">
                    {!editing && myPages.length > 0 && (
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

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold opacity-70">Category</Label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                                <SelectContent>{ANNOUNCEMENT_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold opacity-70">Who can see it</Label>
                            <Select value={audience} onValueChange={(v) => setAudience(v as any)}>
                                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="everyone">Everyone</SelectItem>
                                    <SelectItem value="followers">Followers only</SelectItem>
                                    {selectedPageId !== 'personal' && <SelectItem value="team">Team only</SelectItem>}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold opacity-70">Publish at (optional)</Label>
                            <Input type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} className="h-11" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold opacity-70">Ends on (optional)</Label>
                            <Input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} className="h-11" />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {imageUrl ? (
                            <div className="relative">
                                <img src={imageUrl} alt="" className="h-20 w-32 rounded-xl object-cover border border-border" />
                                <button type="button" onClick={() => setImageUrl(null)} className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border border-border flex items-center justify-center"><X size={12} /></button>
                            </div>
                        ) : (
                            <label className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm font-semibold cursor-pointer hover:bg-muted/30">
                                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4 text-primary" />} Add a cover image
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadCover(e.target.files?.[0] || null)} />
                            </label>
                        )}
                        <div className="flex items-center gap-2 ml-auto">
                            <Switch id="pin" checked={pinned} onCheckedChange={setPinned} />
                            <Label htmlFor="pin" className="text-sm font-semibold">Pin to top</Label>
                        </div>
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
                            {editing ? 'Save changes' : 'Post Announcement'}
                        </Button>
                    </DialogFooter>
                </form>
                )}
            </DialogContent>
        </Dialog>
    );
};
