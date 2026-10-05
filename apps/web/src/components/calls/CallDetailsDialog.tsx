import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Phone, UserCheck, Crown, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface ParticipantInfo {
  id: string;
  full_name: string;
  username: string;
  avatar_url?: string;
  role?: string;
  status?: string;
}

interface CallDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  message: any;
  roomType: 'direct' | 'discussion' | 'project';
  roomId: string;
}

export const CallDetailsDialog: React.FC<CallDetailsDialogProps> = ({
  isOpen,
  onClose,
  message,
  roomType,
  roomId,
}) => {
  const [loading, setLoading] = useState(true);
  const [hostInfo, setHostInfo] = useState<ParticipantInfo | null>(null);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);

  useEffect(() => {
    if (!isOpen || !roomId || !message) return;

    const fetchCallInfo = async () => {
      setLoading(true);
      try {
        // 1. Resolve host profile from message sender or database
        const hostId = message.sender_id || message.user_id;
        const msgProfile = message.sender_profile || message.profiles;

        let hostProfile: ParticipantInfo | null = null;

        if (msgProfile) {
          hostProfile = {
            id: hostId,
            full_name: msgProfile.full_name || 'User',
            username: msgProfile.username || 'user',
            avatar_url: msgProfile.avatar_url || undefined,
            role: 'Host'
          };
        } else if (hostId) {
          const { data: p } = await supabase
            .from('profiles')
            .select('id, full_name, username, avatar_url')
            .eq('id', hostId)
            .maybeSingle();

          if (p) {
            hostProfile = {
              id: p.id,
              full_name: p.full_name || 'User',
              username: p.username || 'user',
              avatar_url: p.avatar_url || undefined,
              role: 'Host'
            };
          }
        }
        setHostInfo(hostProfile);

        // 2. Query call record & joined participants
        const { data: callData } = await (supabase
          .from('calls' as any)
          .select('id, started_by')
          .eq('room_type', roomType)
          .eq('room_id', roomId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle() as any);

        if (callData) {
          const { data: partData } = await (supabase
            .from('call_participants' as any)
            .select('user_id, status, profiles:user_id(id, full_name, username, avatar_url)')
            .eq('call_id', callData.id) as any);

          if (partData && partData.length > 0) {
            const list: ParticipantInfo[] = partData.map((cp: any) => {
              const profile = Array.isArray(cp.profiles) ? cp.profiles[0] : cp.profiles;
              return {
                id: cp.user_id,
                full_name: profile?.full_name || 'Participant',
                username: profile?.username || 'user',
                avatar_url: profile?.avatar_url || undefined,
                role: cp.user_id === callData.started_by ? 'Host' : 'Participant',
                status: cp.status || 'joined'
              };
            });
            setParticipants(list);
          } else if (hostProfile) {
            setParticipants([hostProfile]);
          }
        } else if (hostProfile) {
          setParticipants([hostProfile]);
        }
      } catch (err) {
        console.warn('Error fetching call details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCallInfo();
  }, [isOpen, roomId, roomType, message]);

  if (!message) return null;

  const rawContent = message.content || '';
  const displayContent = rawContent.replace(/^📞\s*/, '');
  const isStarted = displayContent.includes('started');
  const messageDate = message.created_at ? new Date(message.created_at) : new Date();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-2xl border-border/40 shadow-2xl rounded-3xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isStarted ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-400'}`}>
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                {displayContent}
              </DialogTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <Clock className="w-3.5 h-3.5" />
                <span>{format(messageDate, 'pp')}</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {/* Host Card */}
            {hostInfo && (
              <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20">
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-2 flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-500" /> Call Initiator / Host
                </p>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border border-primary/20">
                    <AvatarImage src={hostInfo.avatar_url} />
                    <AvatarFallback className="bg-primary/20 text-primary font-bold">
                      {hostInfo.full_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{hostInfo.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">@{hostInfo.username}</p>
                  </div>
                  <Badge variant="secondary" className="bg-primary/20 text-primary text-[10px]">Host</Badge>
                </div>
              </div>
            )}

            {/* Joined Participants List */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" /> Call Participants ({participants.length})
              </p>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {participants.length > 0 ? (
                  participants.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40 hover:bg-muted/70 transition-all border border-border/30">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={p.avatar_url} />
                        <AvatarFallback className="bg-secondary text-secondary-foreground font-bold text-xs">
                          {p.full_name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{p.full_name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">@{p.username}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {p.role === 'Host' ? 'Host' : 'Joined'}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground italic py-2 text-center">No participants recorded</p>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
