import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Search, Send, Check, Reply, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { generateDirectRoomId } from '@/lib/chat-utils';

interface ProfileItem {
  id: string;
  full_name: string;
  avatar_url: string;
  role?: string;
}

interface ForwardMessageDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  messagesToForward: any[];
  currentUserId?: string;
  onForwardSuccess?: () => void;
}

export const ForwardMessageDialog: React.FC<ForwardMessageDialogProps> = ({
  isOpen,
  onOpenChange,
  messagesToForward,
  currentUserId,
  onForwardSuccess
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [forwarding, setForwarding] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchRecentContacts();
      setSelectedRecipientIds([]);
      setSearchQuery('');
    }
  }, [isOpen]);

  const fetchRecentContacts = async () => {
    try {
      setLoadingProfiles(true);
      const { data: { user } } = await supabase.auth.getUser();
      const userId = currentUserId || user?.id;
      if (!userId) return;

      const { data: sentData } = await supabase
        .from('direct_messages')
        .select('receiver_id')
        .eq('sender_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);

      const { data: recData } = await supabase
        .from('direct_messages')
        .select('sender_id')
        .eq('receiver_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);

      const partnerIds = Array.from(new Set([
        ...(sentData || []).map(m => m.receiver_id),
        ...(recData || []).map(m => m.sender_id)
      ])).filter(id => id && id !== userId);

      if (partnerIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', partnerIds.slice(0, 20));

        if (profileData) {
          setProfiles(profileData as unknown as ProfileItem[]);
        }
      } else {
        const { data: fallbackProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .neq('id', userId)
          .limit(15);
        
        if (fallbackProfiles) {
          setProfiles(fallbackProfiles as unknown as ProfileItem[]);
        }
      }
    } catch (err) {
      console.error('Error fetching contacts for forwarding:', err);
    } finally {
      setLoadingProfiles(false);
    }
  };

  const toggleSelectRecipient = (id: string) => {
    setSelectedRecipientIds(prev => 
      prev.includes(id) ? prev.filter(rId => rId !== id) : [...prev, id]
    );
  };

  const handleForward = async () => {
    if (selectedRecipientIds.length === 0 || messagesToForward.length === 0) return;
    
    try {
      setForwarding(true);
      const { data: { user } } = await supabase.auth.getUser();
      const senderId = currentUserId || user?.id;
      if (!senderId) return;

      for (const targetId of selectedRecipientIds) {
        const channelId = generateDirectRoomId(senderId, targetId);

        for (const msg of messagesToForward) {
          let forwardedContent = msg.content || '';
          
          if (!forwardedContent.startsWith('FORWARDED::')) {
            forwardedContent = `FORWARDED::${forwardedContent}`;
          }

          const insertPayload: any = {
            sender_id: senderId,
            receiver_id: targetId,
            channel_id: channelId,
            content: forwardedContent,
            created_at: new Date().toISOString(),
            is_read: false
          };

          if (msg.attachment_url) {
            insertPayload.attachment_url = msg.attachment_url;
            insertPayload.attachment_type = msg.attachment_type;
          }

          const { error: insertErr } = await supabase.from('direct_messages').insert(insertPayload);
          if (insertErr) {
            console.error('Insert error during message forward:', insertErr);
          }
        }

        window.dispatchEvent(new CustomEvent('chat_list_update', {
          detail: { senderId, receiverId: targetId }
        }));
      }

      toast({
        title: "Forwarded",
        description: `Forwarded ${messagesToForward.length} message${messagesToForward.length > 1 ? 's' : ''} to ${selectedRecipientIds.length} contact${selectedRecipientIds.length > 1 ? 's' : ''}.`
      });

      if (onForwardSuccess) onForwardSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error('Error forwarding message:', err);
      toast({
        title: "Forward Failed",
        description: "Could not forward message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setForwarding(false);
    }
  };

  const filteredProfiles = profiles.filter(p => 
    p.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-[92vw] sm:max-w-md rounded-2xl p-5 bg-slate-900 text-white border-2 border-slate-700 shadow-2xl z-[1000] !opacity-100"
        onClick={(e) => e.stopPropagation()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-left pb-3 border-b border-slate-800">
          <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-white">
            <Reply className="h-5 w-5 text-primary scale-x-[-1]" /> Forward Message
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-300">
            Select one or more contacts to forward {messagesToForward.length} message{messagesToForward.length > 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        {/* Search Input */}
        <div className="relative my-2" onClick={(e) => e.stopPropagation()}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contacts..."
            className="pl-9 h-9 text-xs rounded-xl bg-slate-800 border border-slate-700 text-white placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-slate-600 focus:outline-none"
          />
        </div>

        {/* Recipients List */}
        <div 
          className="max-h-[55vh] sm:max-h-[280px] overflow-y-auto space-y-2 py-1 scrollbar-thin touch-pan-y overscroll-contain pr-1"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {loadingProfiles ? (
            <div className="flex justify-center py-8 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No contacts found
            </div>
          ) : (
            filteredProfiles.map(profile => {
              const isSelected = selectedRecipientIds.includes(profile.id);
              return (
                <div
                  key={profile.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleSelectRecipient(profile.id);
                  }}
                  className={cn(
                    "flex items-center justify-between py-1.5 px-3 rounded-lg cursor-pointer transition-all border select-none",
                    isSelected 
                      ? "bg-primary/20 border-primary/60 text-white font-semibold shadow-sm" 
                      : "bg-slate-800/60 border-slate-700/60 hover:bg-slate-700/70 text-slate-200"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Avatar className="h-7 w-7 shrink-0 border border-slate-600">
                      <AvatarImage src={profile.avatar_url} />
                      <AvatarFallback className="text-[10px] font-bold bg-slate-700 text-slate-200">
                        {profile.full_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate leading-tight text-white">{profile.full_name}</p>
                      {profile.role && <p className="text-[9px] text-slate-300 capitalize leading-tight mt-0.5">{profile.role}</p>}
                    </div>
                  </div>

                  <div className={cn(
                    "w-4 h-4 rounded-full flex items-center justify-center border transition-all shrink-0 ml-2",
                    isSelected ? "bg-primary border-primary text-white font-bold" : "border-slate-500 bg-slate-800"
                  )}>
                    {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Action */}
        <div className="pt-3 flex justify-end gap-2 border-t border-slate-800 mt-2" onClick={(e) => e.stopPropagation()}>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenChange(false);
            }}
            className="text-xs h-8 rounded-xl bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
            disabled={forwarding}
          >
            Cancel
          </Button>
          <Button 
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleForward();
            }}
            disabled={selectedRecipientIds.length === 0 || forwarding}
            className="text-xs h-8 rounded-xl gap-1.5 px-4 font-extrabold shadow-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-40"
          >
            {forwarding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            <span>Forward ({selectedRecipientIds.length})</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
