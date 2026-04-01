import { useState } from "react";
import { MessageCircle, Phone, Users, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCall } from "@/hooks/useCall";
import { DiscussionChatInterface } from "../discussions/DiscussionChatInterface";
import { Category } from "../discussions/types";

interface DiscussionRoomProps {
  id?: string;
  title: string;
  description: string;
  memberCount: number;
  members: Array<{ initials: string; color: string }>;
  categoryId: string;
  categories: Category[];
}

const DiscussionRoomCard = ({
  id,
  title,
  description,
  memberCount,
  members: _members,
  categoryId,
  categories
}: DiscussionRoomProps) => {
  const [showChat, setShowChat] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeCall, loading: callLoading, startCall } = useCall('discussion', id || '');

  const joinRoom = async () => {
    if (!id) return;

    setIsJoining(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to join discussion rooms",
          variant: "destructive",
        });
        return;
      }

      const { data: existingMember } = await supabase
        .from('room_members')
        .select('id')
        .eq('room_id', id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existingMember) {
        const { error } = await supabase
          .from('room_members')
          .insert([{ room_id: id, user_id: user.id, role: 'member' }]);
        if (error) throw error;
      }

      setShowChat(true);
      toast({
        title: "Joined room",
        description: `Welcome to ${title}!`,
      });
    } catch (error) {
      console.error('Error joining room:', error);
      toast({
        title: "Error",
        description: "Failed to join room",
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
  };

  const handleStartCall = async () => {
    if (!id || !user) {
      toast({
        title: "Authentication required",
        description: "Please log in to start calls",
        variant: "destructive",
      });
      return;
    }

    // Ensure membership first
    const { data: existingMember } = await supabase
      .from('room_members')
      .select('id')
      .eq('room_id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!existingMember) {
      await supabase
        .from('room_members')
        .insert([{ room_id: id, user_id: user.id, role: 'member' }]);
    }

    const call = await startCall();
    if (call) {
      setShowChat(true);
      toast({
        title: "Call started",
        description: `Call is active in "${title}"`,
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to start call. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRoomUpdated = (_roomId: string, _newTitle: string, _newDescription: string) => {

  };

  return (
    <>
      <div className="group h-full">
        <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl transition-all duration-500 hover:border-primary/40 hover:shadow-xl h-full flex flex-col">

          {/* Top gradient accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/60 via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          {/* Live call indicator */}
          {activeCall && (
            <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-green-500/15 border border-green-500/30 text-green-400 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" />
              Live
            </div>
          )}

          <div className="p-5 flex flex-col flex-1">
            {/* Title */}
            <h3 className="text-lg font-bold tracking-tight text-foreground line-clamp-1 group-hover:text-primary transition-colors duration-300 mb-3 pr-16">
              {title}
            </h3>

            {/* Description */}
            <p className="text-sm text-muted-foreground/80 line-clamp-2 leading-relaxed mb-4 flex-1">
              {description || 'No description provided.'}
            </p>

            {/* Members */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
                  <Users className="h-3 w-3 text-primary" />
                </div>
                <span className="font-medium">{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
              </div>
              {activeCall && (
                <div className="flex items-center gap-1.5 text-xs text-green-400">
                  <Sparkles className="h-3 w-3" />
                  <span className="font-medium">Call active</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-auto pt-4 border-t border-border/30">
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md hover:shadow-lg transition-all duration-300 rounded-xl h-10"
                  onClick={joinRoom}
                  disabled={isJoining}
                >
                  {isJoining ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Join Chat
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className={`flex-1 font-semibold rounded-xl h-10 transition-all duration-300 ${activeCall
                    ? 'border-green-500/50 text-green-400 hover:bg-green-500/10 hover:border-green-500/70 shadow-sm shadow-green-500/10'
                    : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5'
                    }`}
                  onClick={handleStartCall}
                  disabled={callLoading}
                >
                  {callLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                  ) : (
                    <>
                      <Phone className="h-4 w-4 mr-2" />
                      Join Call
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showChat} onOpenChange={setShowChat}>
        <DialogContent className="max-w-4xl h-[90vh] md:h-[600px] flex flex-col p-0">
          <div className="flex-1 overflow-hidden">
            {id && showChat && (
              <DiscussionChatInterface
                roomId={id}
                userRole="member"
                roomTitle={title}
                roomDescription={description}
                categoryId={categoryId}
                categories={categories}
                roomType="public"
                onClose={() => setShowChat(false)}
                onRoomUpdated={handleRoomUpdated}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DiscussionRoomCard;
