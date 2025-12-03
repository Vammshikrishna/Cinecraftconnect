
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, X, Lock, Globe, Users, Tag, Shield } from 'lucide-react';
import { DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
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
        .select('room_type, member_limit, tags')
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
          member_limit: memberLimit,
          tags: tags
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
    <DialogContent className="glass-modal border-border max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-foreground flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Room Settings
        </DialogTitle>
        <DialogDescription className="text-muted-foreground">
          Manage your discussion room settings and preferences
        </DialogDescription>
      </DialogHeader>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-2 text-foreground">Room Name *</label>
            <Input
              id="title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="glass-input"
              placeholder="Enter room name"
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground mt-1">{title.length}/100 characters</p>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-2 text-foreground">Description</label>
            <Textarea
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="glass-input min-h-[100px]"
              placeholder="Describe what this room is about..."
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1">{description.length}/500 characters</p>
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium mb-2 text-foreground">Category *</label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full glass-input">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent className="glass-dropdown">
                {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">Tags (max 10)</label>
            <div className="flex gap-2 mb-2">
              <Input
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="Add a tag..."
                className="glass-input"
                maxLength={20}
              />
              <Button onClick={handleAddTag} disabled={tags.length >= 10} size="sm">
                <Tag className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => handleRemoveTag(tag)} />
                </Badge>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Privacy Settings */}
        <TabsContent value="privacy" className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-card/50">
              <div className="flex-1">
                <Label className="flex items-center gap-2 text-foreground font-medium">
                  {isPrivate ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                  Room Visibility
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {isPrivate
                    ? 'Only invited members can see and join this room'
                    : 'Anyone can discover and join this room'}
                </p>
              </div>
              <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
            </div>

            <div>
              <Label className="flex items-center gap-2 text-foreground font-medium mb-2">
                <Users className="h-4 w-4" />
                Member Limit
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={memberLimit || ''}
                  onChange={e => setMemberLimit(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="No limit"
                  className="glass-input"
                  min={1}
                  max={1000}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMemberLimit(null)}
                >
                  Clear
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty for unlimited members
              </p>
            </div>
          </div>
        </TabsContent>

        {/* Advanced Settings */}
        <TabsContent value="advanced" className="space-y-4">
          <div className="p-4 border border-destructive/50 rounded-lg bg-destructive/5">
            <h3 className="font-semibold text-destructive mb-2">Danger Zone</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Deleting this room is permanent and cannot be undone. All messages and data will be lost.
            </p>
            {!isConfirmingDelete ? (
              <Button variant="destructive" onClick={() => setConfirmingDelete(true)}>
                Delete Room
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Delete'}
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <DialogFooter className="pt-4 border-t border-border">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};
