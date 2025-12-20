import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, X, Lock, Globe, Tag, Shield } from 'lucide-react';
import { DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

interface RoomSettingsProps {
  roomId: string;
  currentTitle: string;
  currentDescription: string | null;
  currentCategory: string;
  categories: { id: string, name: string }[];
  onRoomUpdated: (roomId: string, newTitle: string, newDescription: string) => void;
  onClose: () => void;
}

export const RoomSettings = ({ roomId, currentTitle, currentDescription, currentCategory, categories, onRoomUpdated, onClose }: RoomSettingsProps) => {
  const { toast } = useToast();
  const [title, setTitle] = useState(currentTitle);
  const [description, setDescription] = useState(currentDescription || '');
  const [categoryId, setCategoryId] = useState(currentCategory);
  const [isPrivate, setIsPrivate] = useState(false);
  const [memberLimit, setMemberLimit] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [isConfirmingDelete, setConfirmingDelete] = useState(false);

  // Fetch current room settings
  useEffect(() => {
    const fetchRoomDetails = async () => {
      const { data } = await supabase
        .from('discussion_rooms')
        .select('room_type')
        .eq('id', roomId)
        .single();

      if (data) {
        const roomData = data as any;
        setIsPrivate(roomData.room_type === 'private');
        if (roomData.member_limit !== undefined) setMemberLimit(roomData.member_limit);
        if (roomData.tags !== undefined) setTags(roomData.tags || []);
      }
    };
    fetchRoomDetails();
  }, [roomId]);

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim()) && tags.length < 10) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('discussion_rooms')
        .update({
          title,
          description,
          category_id: categoryId,
          room_type: isPrivate ? 'private' : 'public',
          name: title
        })
        .eq('id', roomId);

      if (error) throw error;

      onRoomUpdated(roomId, title, description);
      toast({ title: "Success", description: "Room settings have been updated." });
      onClose();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase.from('discussion_rooms').delete().eq('id', roomId);
      if (error) throw error;

      toast({ title: "Room Deleted", description: "The room has been permanently deleted." });
      onClose();
    } catch (error: any) {
      toast({ title: "Error Deleting Room", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <DialogContent className="max-w-4xl max-h-[90vh] h-[600px] overflow-hidden p-0 gap-0 border-border shadow-2xl bg-background text-foreground">
      <Tabs defaultValue="general" orientation="vertical" className="flex h-full w-full">

        {/* Sidebar Navigation */}
        <div className="w-64 bg-muted/30 border-r border-border p-6 flex flex-col gap-6 shrink-0">
          <div className="flex items-center gap-3 text-primary mb-2">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="font-bold text-lg leading-tight">Room Settings</DialogTitle>
              <DialogDescription className="text-[10px] text-muted-foreground font-medium">Manage preferences</DialogDescription>
            </div>
          </div>

          <TabsList className="flex flex-col h-auto bg-transparent gap-2 p-0 justify-start w-full">
            <TabsTrigger
              value="general"
              className="w-full justify-start gap-3 px-4 py-3 h-auto data-[state=active]:bg-primary/10 data-[state=active]:text-primary hover:bg-muted/50 transition-all duration-200 rounded-lg border border-transparent font-medium text-muted-foreground"
            >
              <Tag className="h-4 w-4" />
              <span>General</span>
            </TabsTrigger>
            <TabsTrigger
              value="privacy"
              className="w-full justify-start gap-3 px-4 py-3 h-auto data-[state=active]:bg-primary/10 data-[state=active]:text-primary hover:bg-muted/50 transition-all duration-200 rounded-lg border border-transparent font-medium text-muted-foreground"
            >
              <Lock className="h-4 w-4" />
              <span>Privacy</span>
            </TabsTrigger>
            <TabsTrigger
              value="advanced"
              className="w-full justify-start gap-3 px-4 py-3 h-auto data-[state=active]:bg-destructive/10 data-[state=active]:text-destructive hover:bg-destructive/5 transition-all duration-200 rounded-lg border border-transparent font-medium text-muted-foreground"
            >
              <Shield className="h-4 w-4" />
              <span>Danger Zone</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-auto pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground/50 text-center font-mono">ID: {roomId.slice(0, 8)}</p>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col relative min-w-0 bg-background">
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">

            {/* General Tab */}
            <TabsContent value="general" className="space-y-6 m-0 animate-in fade-in slide-in-from-right-4 duration-300 outline-none">
              <div>
                <h3 className="text-xl font-semibold mb-1 tracking-tight">General Information</h3>
                <p className="text-sm text-muted-foreground mb-6">Configure the basic details of your room.</p>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Room Name</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      className="h-11 bg-muted/30 border-border focus:bg-background transition-colors"
                      placeholder="e.g. Cinematography 101"
                      maxLength={100}
                    />
                    <p className="text-[10px] text-muted-foreground text-right">{title.length}/100</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      className="min-h-[120px] resize-none bg-muted/30 border-border focus:bg-background transition-colors"
                      placeholder="What is this discussion about?"
                      maxLength={500}
                    />
                    <p className="text-[10px] text-muted-foreground text-right">{description.length}/500</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category</Label>
                    <Select value={categoryId} onValueChange={setCategoryId}>
                      <SelectTrigger className="w-full h-11 bg-muted/30 border-border focus:bg-background">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 pt-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tags</Label>
                    <div className="flex gap-2">
                      <Input
                        value={newTag}
                        onChange={e => setNewTag(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                        placeholder="Add a tag..."
                        className="h-10 bg-muted/30 border-border focus:bg-background"
                        maxLength={20}
                      />
                      <Button onClick={handleAddTag} disabled={tags.length >= 10} size="sm" variant="secondary" className="h-10 px-4">
                        <Tag className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3 min-h-[30px]">
                      {tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="gap-1 pl-2 pr-1 py-1 cursor-default">
                          {tag}
                          <div role="button" onClick={() => handleRemoveTag(tag)} className="hover:bg-destructive/20 hover:text-destructive rounded-full p-0.5 transition-colors">
                            <X className="h-3 w-3" />
                          </div>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Privacy Tab */}
            <TabsContent value="privacy" className="space-y-6 m-0 animate-in fade-in slide-in-from-right-4 duration-300 outline-none">
              <div>
                <h3 className="text-xl font-semibold mb-1 tracking-tight">Privacy & Access</h3>
                <p className="text-sm text-muted-foreground mb-6">Control who can see and join your room.</p>

                <div className="space-y-6">
                  <div className="flex items-center justify-between p-5 border border-border rounded-xl bg-muted/30">
                    <div className="flex-1 pr-4">
                      <Label className="flex items-center gap-2 text-base font-semibold mb-1 text-foreground">
                        {isPrivate ? <Lock className="h-4 w-4 text-primary" /> : <Globe className="h-4 w-4 text-primary" />}
                        {isPrivate ? 'Private Room' : 'Public Room'}
                      </Label>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {isPrivate
                          ? 'Only members you explicitly invite can see and join this room.'
                          : 'Anyone in the community can discover, view, and join this room.'}
                      </p>
                    </div>
                    <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
                  </div>

                  <div className="space-y-3 pt-4 border-t border-border">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Member Limit</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        value={memberLimit || ''}
                        onChange={e => setMemberLimit(e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="Unlimited"
                        className="h-11 w-40 bg-muted/30 border-border focus:bg-background"
                        min={1}
                        max={1000}
                      />
                      {memberLimit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setMemberLimit(null)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          Reset to Unlimited
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Advanced Tab */}
            <TabsContent value="advanced" className="space-y-6 m-0 animate-in fade-in slide-in-from-right-4 duration-300 outline-none">
              <div>
                <h3 className="text-xl font-semibold mb-1 text-destructive">Danger Zone</h3>
                <p className="text-sm text-muted-foreground mb-6">Irreversible actions for this room.</p>

                <div className="border border-destructive/20 rounded-xl bg-destructive/5 p-6 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full shrink-0">
                      <Shield className="h-6 w-6 text-destructive" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg text-foreground mb-1">Delete Room</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                        Permanently remove this room and all its message history. Members will be removed immediately. This action cannot be undone.
                      </p>
                      {!isConfirmingDelete ? (
                        <Button variant="destructive" onClick={() => setConfirmingDelete(true)}>
                          Delete Room
                        </Button>
                      ) : (
                        <div className="flex items-center gap-3 animate-in fade-in duration-200">
                          <Button variant="outline" onClick={() => setConfirmingDelete(false)} className="bg-transparent border-destructive/30 hover:bg-destructive/10 text-destructive">
                            Cancel
                          </Button>
                          <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Confirm Deletion
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>

          {/* Global Footer */}
          <div className="p-6 border-t border-border flex justify-end gap-3 bg-background">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSubmitting} className="min-w-[120px]">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </div>
        </div>
      </Tabs>
    </DialogContent>
  );
};
