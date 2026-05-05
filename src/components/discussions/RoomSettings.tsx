import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, X, Lock, Globe, Tag, Shield, Bell, BellOff, MessageSquareOff, ImageOff, Link2Off, Filter, Clock, Pin, Smile, Volume2, VolumeX, Users,
  Trash2, AlertCircle, MessageSquare, MoreVertical, UserMinus, UserCheck
} from 'lucide-react';
import { DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

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

  // Notification settings
  const [muteRoom, setMuteRoom] = useState(false);
  const [mentionsOnly, setMentionsOnly] = useState(false);
  const [soundAlerts, setSoundAlerts] = useState(true);

  // Moderation settings
  const [slowMode, setSlowMode] = useState(false);
  const [slowModeInterval, setSlowModeInterval] = useState(10);
  const [allowMediaSharing, setAllowMediaSharing] = useState(true);
  const [allowLinks, setAllowLinks] = useState(true);
  const [profanityFilter, setProfanityFilter] = useState(false);

  // Appearance settings
  const [pinnedMessage, setPinnedMessage] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [roomEmoji, setRoomEmoji] = useState('💬');

  // WhatsApp-style settings
  const [onlyAdminsSend, setOnlyAdminsSend] = useState(false);
  const [onlyAdminsEdit, setOnlyAdminsEdit] = useState(false);
  const [creatorId, setCreatorId] = useState<string | null>(null);
  
  // Participants state
  const [members, setMembers] = useState<any[]>([]);
  const [isFetchingMembers, setIsFetchingMembers] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!roomId) return;
    try {
      setIsFetchingMembers(true);
      
      // 1. Fetch room members
      const { data: membersData, error: membersError } = await supabase
        .from('room_members')
        .select('user_id, role, joined_at')
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });

      if (membersError) throw membersError;
      
      if (!membersData || membersData.length === 0) {
        setMembers([]);
        return;
      }

      // 2. Fetch profiles for these users
      const userIds = membersData.map(m => m.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // 3. Fetch user roles to identify internal staff
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      // 4. Merge data and filter out internal staff
      const internalRoles = ['moderator', 'admin', 'super_admin'];
      const mergedMembers = membersData
        .map(member => {
          const userRole = rolesData?.find(r => r.user_id === member.user_id)?.role || 'user';
          return {
            ...member,
            profiles: profilesData?.find(p => p.id === member.user_id) || null,
            isInternal: internalRoles.includes(userRole)
          };
        })
        .filter(m => !m.isInternal); // Gate guard: hide staff from public participant lists

      setMembers(mergedMembers);
    } catch (err) {
      console.error('Error fetching members:', err);
    } finally {
      setIsFetchingMembers(false);
    }
  }, [roomId]);

  const handleMemberAction = async (userId: string, action: 'remove' | 'promote' | 'demote') => {
    try {
      if (action === 'remove') {
        const { error } = await supabase
          .from('room_members')
          .delete()
          .eq('room_id', roomId)
          .eq('user_id', userId);
        if (error) throw error;
        toast({ title: "Member removed", description: "The participant has been removed from the room." });
      } else {
        const newRole = action === 'promote' ? 'admin' : 'member';
        const { error } = await supabase
          .from('room_members')
          .update({ role: newRole })
          .eq('room_id', roomId)
          .eq('user_id', userId);
        if (error) throw error;
        toast({ 
          title: action === 'promote' ? "Admin promoted" : "Admin demoted", 
          description: `User role has been updated to ${newRole}.` 
        });
      }
      fetchMembers();
    } catch (err) {
      console.error('Error performing member action:', err);
      toast({ title: "Action failed", description: "Could not update member status.", variant: "destructive" });
    }
  };

  // Fetch current room settings
  useEffect(() => {
    const fetchRoomDetails = async () => {
      const { data } = await supabase
        .from('discussion_rooms')
        .select('room_type, member_count, tags, settings, creator_id')
        .eq('id', roomId)
        .single();

      if (data) {
        const roomData = data as any;
        setIsPrivate(roomData.room_type === 'private');
        setCreatorId(roomData.creator_id);
        if (roomData.member_count !== undefined) setMemberLimit(roomData.member_count);
        if (roomData.tags !== undefined) setTags(roomData.tags || []);
        
        // Load settings from JSON
        if (roomData.settings) {
          const s = roomData.settings;
          if (s.muteRoom !== undefined) setMuteRoom(s.muteRoom);
          if (s.mentionsOnly !== undefined) setMentionsOnly(s.mentionsOnly);
          if (s.soundAlerts !== undefined) setSoundAlerts(s.soundAlerts);
          if (s.slowMode !== undefined) setSlowMode(s.slowMode);
          if (s.slowModeInterval !== undefined) setSlowModeInterval(s.slowModeInterval);
          if (s.allowMediaSharing !== undefined) setAllowMediaSharing(s.allowMediaSharing);
          if (s.allowLinks !== undefined) setAllowLinks(s.allowLinks);
          if (s.profanityFilter !== undefined) setProfanityFilter(s.profanityFilter);
          if (s.pinnedMessage !== undefined) setPinnedMessage(s.pinnedMessage);
          if (s.welcomeMessage !== undefined) setWelcomeMessage(s.welcomeMessage);
          if (s.roomEmoji !== undefined) setRoomEmoji(s.roomEmoji);
          if (s.memberLimit !== undefined) setMemberLimit(s.memberLimit);
          if (s.onlyAdminsSend !== undefined) setOnlyAdminsSend(s.onlyAdminsSend);
          if (s.onlyAdminsEdit !== undefined) setOnlyAdminsEdit(s.onlyAdminsEdit);
        }
      }
    };
    
    fetchRoomDetails();
    fetchMembers();
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
      const roomSettings = {
        memberLimit,
        muteRoom,
        mentionsOnly,
        soundAlerts,
        slowMode,
        slowModeInterval,
        allowMediaSharing,
        allowLinks,
        profanityFilter,
        pinnedMessage,
        welcomeMessage,
        roomEmoji,
        onlyAdminsSend,
        onlyAdminsEdit
      };

      const { error } = await supabase
        .from('discussion_rooms')
        .update({
          title,
          description,
          category_id: categoryId,
          room_type: isPrivate ? 'private' : 'public',
          tags: tags,
          settings: roomSettings as any
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

  const handleClearHistory = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('room_messages')
        .delete()
        .eq('room_id', roomId);
      
      if (error) throw error;

      toast({ title: "History Cleared", description: "All messages in this room have been removed." });
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to clear history: " + error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogContent className="max-w-4xl max-h-[90vh] h-[90vh] md:h-[600px] overflow-hidden p-0 gap-0 border-border shadow-2xl bg-background text-foreground flex flex-col">
      <Tabs defaultValue="general" className="flex flex-col md:flex-row h-full w-full">

        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 bg-muted/30 border-b md:border-b-0 md:border-r border-border p-4 md:p-6 flex flex-col gap-4 md:gap-6 shrink-0 h-auto md:h-full">
          <div className="flex items-center gap-3 text-primary mb-2">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="font-bold text-lg leading-tight">Room Settings</DialogTitle>
              <DialogDescription className="text-[10px] text-muted-foreground font-medium">Manage preferences</DialogDescription>
            </div>
          </div>

          <TabsList className="flex flex-row md:flex-col overflow-x-auto md:overflow-visible h-auto bg-transparent gap-2 p-0 justify-start w-full no-scrollbar">
            <TabsTrigger
              value="general"
              className="flex-1 md:flex-none justify-center md:justify-start gap-2 md:gap-3 px-3 py-2 md:px-4 md:py-3 h-auto data-[state=active]:bg-primary/10 data-[state=active]:text-primary hover:bg-muted/50 transition-all duration-200 rounded-lg border border-transparent font-medium text-muted-foreground whitespace-nowrap"
            >
              <Tag className="h-4 w-4 shrink-0" />
              <span>General</span>
            </TabsTrigger>
            <TabsTrigger
              value="privacy"
              className="flex-1 md:flex-none justify-center md:justify-start gap-2 md:gap-3 px-3 py-2 md:px-4 md:py-3 h-auto data-[state=active]:bg-primary/10 data-[state=active]:text-primary hover:bg-muted/50 transition-all duration-200 rounded-lg border border-transparent font-medium text-muted-foreground whitespace-nowrap"
            >
              <Lock className="h-4 w-4 shrink-0" />
              <span>Privacy</span>
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="flex-1 md:flex-none justify-center md:justify-start gap-2 md:gap-3 px-3 py-2 md:px-4 md:py-3 h-auto data-[state=active]:bg-primary/10 data-[state=active]:text-primary hover:bg-muted/50 transition-all duration-200 rounded-lg border border-transparent font-medium text-muted-foreground whitespace-nowrap"
            >
              <Bell className="h-4 w-4 shrink-0" />
              <span>Notifications</span>
            </TabsTrigger>
            <TabsTrigger
              value="moderation"
              className="flex-1 md:flex-none justify-center md:justify-start gap-2 md:gap-3 px-3 py-2 md:px-4 md:py-3 h-auto data-[state=active]:bg-primary/10 data-[state=active]:text-primary hover:bg-muted/50 transition-all duration-200 rounded-lg border border-transparent font-medium text-muted-foreground whitespace-nowrap"
            >
              <Filter className="h-4 w-4 shrink-0" />
              <span>Moderation</span>
            </TabsTrigger>
            <TabsTrigger
              value="appearance"
              className="flex-1 md:flex-none justify-center md:justify-start gap-2 md:gap-3 px-3 py-2 md:px-4 md:py-3 h-auto data-[state=active]:bg-primary/10 data-[state=active]:text-primary hover:bg-muted/50 transition-all duration-200 rounded-lg border border-transparent font-medium text-muted-foreground whitespace-nowrap"
            >
              <Smile className="h-4 w-4 shrink-0" />
              <span>Appearance</span>
            </TabsTrigger>
            <TabsTrigger
              value="members"
              className="flex-1 md:flex-none justify-center md:justify-start gap-2 md:gap-3 px-3 py-2 md:px-4 md:py-3 h-auto data-[state=active]:bg-primary/10 data-[state=active]:text-primary hover:bg-muted/50 transition-all duration-200 rounded-lg border border-transparent font-medium text-muted-foreground whitespace-nowrap"
            >
              <Users className="h-4 w-4 shrink-0" />
              <span>Participants</span>
            </TabsTrigger>
            <TabsTrigger
              value="advanced"
              className="flex-1 md:flex-none justify-center md:justify-start gap-2 md:gap-3 px-3 py-2 md:px-4 md:py-3 h-auto data-[state=active]:bg-destructive/10 data-[state=active]:text-destructive hover:bg-destructive/5 transition-all duration-200 rounded-lg border border-transparent font-medium text-muted-foreground whitespace-nowrap"
            >
              <Shield className="h-4 w-4 shrink-0" />
              <span>Danger Zone</span>
            </TabsTrigger>
          </TabsList>

          <div className="hidden md:block mt-auto pt-6 border-t border-border">
            {/* ID hidden as requested */}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col relative min-w-0 bg-background overflow-hidden h-full">
          <ScrollArea className="flex-1 w-full h-full">
            <div className="p-8">

              {/* General Tab */}
              <TabsContent value="general" className="space-y-6 m-0 animate-in fade-in slide-in-from-right-4 duration-300 focus:outline-none focus-visible:outline-none focus-visible:ring-0 data-[state=inactive]:hidden">
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
              <TabsContent value="privacy" className="space-y-6 m-0 animate-in fade-in slide-in-from-right-4 duration-300 focus:outline-none focus-visible:outline-none focus-visible:ring-0 data-[state=inactive]:hidden">
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

              {/* Notifications Tab */}
              <TabsContent value="notifications" className="space-y-6 m-0 animate-in fade-in slide-in-from-right-4 duration-300 focus:outline-none focus-visible:outline-none focus-visible:ring-0 data-[state=inactive]:hidden">
                <div>
                  <h3 className="text-xl font-semibold mb-1 tracking-tight">Notifications</h3>
                  <p className="text-sm text-muted-foreground mb-6">Manage how you receive notifications from this room.</p>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-5 border border-border rounded-xl bg-muted/30">
                      <div className="flex-1 pr-4">
                        <Label className="flex items-center gap-2 text-base font-semibold mb-1 text-foreground">
                          {muteRoom ? <BellOff className="h-4 w-4 text-muted-foreground" /> : <Bell className="h-4 w-4 text-primary" />}
                          Mute Room
                        </Label>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Silence all notifications from this room. You can still read messages.
                        </p>
                      </div>
                      <Switch checked={muteRoom} onCheckedChange={setMuteRoom} />
                    </div>

                    <div className="flex items-center justify-between p-5 border border-border rounded-xl bg-muted/30">
                      <div className="flex-1 pr-4">
                        <Label className="flex items-center gap-2 text-base font-semibold mb-1 text-foreground">
                          <MessageSquareOff className="h-4 w-4 text-primary" />
                          Mentions Only
                        </Label>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Only get notified when someone mentions you directly.
                        </p>
                      </div>
                      <Switch checked={mentionsOnly} onCheckedChange={setMentionsOnly} disabled={muteRoom} />
                    </div>

                    <div className="flex items-center justify-between p-5 border border-border rounded-xl bg-muted/30">
                      <div className="flex-1 pr-4">
                        <Label className="flex items-center gap-2 text-base font-semibold mb-1 text-foreground">
                          {soundAlerts ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
                          Sound Alerts
                        </Label>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Play a sound when new messages arrive in this room.
                        </p>
                      </div>
                      <Switch checked={soundAlerts} onCheckedChange={setSoundAlerts} disabled={muteRoom} />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Moderation Tab */}
              <TabsContent value="moderation" className="space-y-6 m-0 animate-in fade-in slide-in-from-right-4 duration-300 focus:outline-none focus-visible:outline-none focus-visible:ring-0 data-[state=inactive]:hidden">
                <div>
                  <h3 className="text-xl font-semibold mb-1 tracking-tight">Moderation</h3>
                  <p className="text-sm text-muted-foreground mb-6">Control content and behavior in your room.</p>

                  <div className="space-y-4">
                    <div className="p-5 border border-border rounded-xl bg-muted/30 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 pr-4">
                          <Label className="flex items-center gap-2 text-base font-semibold mb-1 text-foreground">
                            <Clock className="h-4 w-4 text-primary" />
                            Slow Mode
                          </Label>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            Limit how often members can send messages.
                          </p>
                        </div>
                        <Switch checked={slowMode} onCheckedChange={setSlowMode} />
                      </div>
                      {slowMode && (
                        <div className="flex items-center gap-3 pt-2 border-t border-border animate-in fade-in duration-200">
                          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground shrink-0">Interval</Label>
                          <Select value={String(slowModeInterval)} onValueChange={(v) => setSlowModeInterval(Number(v))}>
                            <SelectTrigger className="w-40 h-9 bg-background border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="5">5 seconds</SelectItem>
                              <SelectItem value="10">10 seconds</SelectItem>
                              <SelectItem value="30">30 seconds</SelectItem>
                              <SelectItem value="60">1 minute</SelectItem>
                              <SelectItem value="300">5 minutes</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between p-5 border border-border rounded-xl bg-muted/30">
                      <div className="flex-1 pr-4">
                        <Label className="flex items-center gap-2 text-base font-semibold mb-1 text-foreground">
                          <ImageOff className="h-4 w-4 text-primary" />
                          Allow Media Sharing
                        </Label>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Let members share images, videos, and files in this room.
                        </p>
                      </div>
                      <Switch checked={allowMediaSharing} onCheckedChange={setAllowMediaSharing} />
                    </div>

                    <div className="flex items-center justify-between p-5 border border-border rounded-xl bg-muted/30">
                      <div className="flex-1 pr-4">
                        <Label className="flex items-center gap-2 text-base font-semibold mb-1 text-foreground">
                          <Link2Off className="h-4 w-4 text-primary" />
                          Allow Links
                        </Label>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Let members share external links in messages.
                        </p>
                      </div>
                      <Switch checked={allowLinks} onCheckedChange={setAllowLinks} />
                    </div>

                    <div className="flex items-center justify-between p-5 border border-border rounded-xl bg-muted/30">
                      <div className="flex-1 pr-4">
                        <Label className="flex items-center gap-2 text-base font-semibold mb-1 text-foreground">
                          <Filter className="h-4 w-4 text-primary" />
                          Profanity Filter
                        </Label>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Automatically filter out inappropriate language.
                        </p>
                      </div>
                      <Switch checked={profanityFilter} onCheckedChange={setProfanityFilter} />
                    </div>

                    <div className="pt-6 border-t border-border">
                      <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Group Permissions</h4>
                      
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 border border-border rounded-xl bg-background shadow-sm">
                          <div className="flex-1 pr-4">
                            <Label className="flex items-center gap-2 text-sm font-semibold mb-0.5">
                              <MessageSquare className="h-4 w-4 text-primary" />
                              Send Messages
                            </Label>
                            <p className="text-xs text-muted-foreground">Choose who can send messages to this room.</p>
                          </div>
                          <Select 
                            value={onlyAdminsSend ? "admins" : "all"} 
                            onValueChange={(v) => setOnlyAdminsSend(v === "admins")}
                          >
                            <SelectTrigger className="w-[140px] h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All participants</SelectItem>
                              <SelectItem value="admins">Only Admins</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center justify-between p-4 border border-border rounded-xl bg-background shadow-sm">
                          <div className="flex-1 pr-4">
                            <Label className="flex items-center gap-2 text-sm font-semibold mb-0.5">
                              <AlertCircle className="h-4 w-4 text-primary" />
                              Edit Room Settings
                            </Label>
                            <p className="text-xs text-muted-foreground">Choose who can change the room's name, emoji, and info.</p>
                          </div>
                          <Select 
                            value={onlyAdminsEdit ? "admins" : "all"} 
                            onValueChange={(v) => setOnlyAdminsEdit(v === "admins")}
                          >
                            <SelectTrigger className="w-[140px] h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All participants</SelectItem>
                              <SelectItem value="admins">Only Admins</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Members Tab */}
              <TabsContent value="members" className="space-y-6 m-0 animate-in fade-in slide-in-from-right-4 duration-300 focus:outline-none focus-visible:outline-none focus-visible:ring-0 data-[state=inactive]:hidden">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-semibold mb-1 tracking-tight">Participants</h3>
                      <p className="text-sm text-muted-foreground">{members.length} members in this room</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchMembers} disabled={isFetchingMembers}>
                      {isFetchingMembers ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Users className="h-3.5 w-3.5 mr-2" />}
                      Refresh
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {members.map((member, index) => {
                      const isCreator = member.user_id === creatorId;
                      const isAdmin = member.role === 'admin' || isCreator;
                      
                      return (
                        <div key={`${member.user_id}-${index}`} className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/30 transition-colors border border-transparent hover:border-border/50">
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="h-10 w-10 border border-border/10">
                              <AvatarImage src={member.profiles?.avatar_url} />
                              <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                                {member.profiles?.full_name?.substring(0, 2).toUpperCase() || "CC"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-bold truncate flex items-center gap-1.5">
                                {member.profiles?.full_name || member.profiles?.username || "Unknown User"}
                                {isCreator && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter">Owner</span>}
                                {!isCreator && isAdmin && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-bold">Admin</span>}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                joined {new Date(member.joined_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          {!isCreator && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 rounded-xl">
                                {isAdmin ? (
                                  <DropdownMenuItem onClick={() => handleMemberAction(member.user_id, 'demote')}>
                                    <UserMinus className="h-4 w-4 mr-2" /> Dismiss as Admin
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => handleMemberAction(member.user_id, 'promote')}>
                                    <UserCheck className="h-4 w-4 mr-2" /> Make Admin
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem 
                                  onClick={() => handleMemberAction(member.user_id, 'remove')}
                                  className="text-destructive focus:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" /> Remove from Group
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </TabsContent>

              {/* Appearance Tab */}
              <TabsContent value="appearance" className="space-y-6 m-0 animate-in fade-in slide-in-from-right-4 duration-300 focus:outline-none focus-visible:outline-none focus-visible:ring-0 data-[state=inactive]:hidden">
                <div>
                  <h3 className="text-xl font-semibold mb-1 tracking-tight">Appearance</h3>
                  <p className="text-sm text-muted-foreground mb-6">Customize how your room looks and feels.</p>

                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Room Icon</Label>
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-2xl border border-border">
                          {roomEmoji}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {['💬', '🎬', '🎥', '🎮', '🎵', '📸', '🎨', '🎭', '📝', '🔥', '⭐', '🚀'].map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => setRoomEmoji(emoji)}
                              className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg hover:bg-primary/10 transition-colors border ${roomEmoji === emoji ? 'border-primary bg-primary/10' : 'border-transparent'
                                }`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Pin className="h-3.5 w-3.5" />
                        Pinned Message
                      </Label>
                      <Textarea
                        value={pinnedMessage}
                        onChange={e => setPinnedMessage(e.target.value)}
                        className="min-h-[80px] resize-none bg-muted/30 border-border focus:bg-background transition-colors"
                        placeholder="Pin an important message at the top of the room..."
                        maxLength={300}
                      />
                      <p className="text-[10px] text-muted-foreground text-right">{pinnedMessage.length}/300</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        Welcome Message
                      </Label>
                      <Textarea
                        value={welcomeMessage}
                        onChange={e => setWelcomeMessage(e.target.value)}
                        className="min-h-[80px] resize-none bg-muted/30 border-border focus:bg-background transition-colors"
                        placeholder="Message shown to new members when they join..."
                        maxLength={300}
                      />
                      <p className="text-[10px] text-muted-foreground text-right">{welcomeMessage.length}/300</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Advanced Tab */}
              <TabsContent value="advanced" className="space-y-6 m-0 animate-in fade-in slide-in-from-right-4 duration-300 focus:outline-none focus-visible:outline-none focus-visible:ring-0 data-[state=inactive]:hidden">
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

                    <div className="pt-6 border-t border-destructive/10">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full shrink-0">
                          <Clock className="h-6 w-6 text-destructive" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-lg text-foreground mb-1">Clear Chat History</h4>
                          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                            Delete all messages in this room while keeping the room itself. This action cannot be undone.
                          </p>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive">
                                Clear History
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Clear chat history?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete all messages and media shared in this room. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleClearHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Clear Everything
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </div>
          </ScrollArea>

          {/* Global Footer */}
          <div className="p-6 border-t border-border flex justify-end gap-3 bg-background mt-auto">
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
