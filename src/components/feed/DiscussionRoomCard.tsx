
import { useState } from "react";
import { Mic, Video, MessageCircle, Phone, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import EnhancedRealTimeChat from "../chat/EnhancedRealTimeChat";

interface DiscussionRoomProps {
  id?: string;
  title: string;
  description: string;
  memberCount: number;
  members: Array<{ initials: string; color: string }>;
  variant?: 'purple' | 'blue';
}

const DiscussionRoomCard = ({ 
  id,
  title, 
  description, 
  memberCount, 
  members, 
  variant = 'purple' 
}: DiscussionRoomProps) => {
  const [showChat, setShowChat] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const { toast } = useToast();

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

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('room_members')
        .select('id')
        .eq('room_id', id)
        .eq('user_id', user.id)
        .single();

      if (!existingMember) {
        // Join the room
        const { error } = await supabase
          .from('room_members')
          .insert([
            {
              room_id: id,
              user_id: user.id,
              role: 'member'
            }
          ]);

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
  return (
    <>
      <div 
        className={`border border-white/10 rounded-lg p-4 bg-gradient-to-b from-black/40 
          ${variant === 'purple' 
            ? 'to-cinesphere-purple/10 hover:from-black/30 hover:to-cinesphere-purple/20' 
            : 'to-cinesphere-blue/10 hover:from-black/30 hover:to-cinesphere-blue/20'} 
          transition-all cursor-pointer`}
      >
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <Badge variant="secondary" className="text-xs">
            <Users className="w-3 h-3 mr-1" />
            {memberCount}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <div className="flex justify-between items-center">
          <div className="flex -space-x-2">
            {members.map((member, index) => (
              <Avatar key={index} className="h-6 w-6 border border-border">
                <AvatarFallback className={`${member.color} text-xs text-foreground`}>
                  {member.initials}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          <div className="flex space-x-2">
            <Dialog open={showChat} onOpenChange={setShowChat}>
              <DialogTrigger asChild>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 w-8 p-0"
                  onClick={joinRoom}
                  disabled={isJoining}
                >
                  <MessageCircle size={16} />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl h-[600px] p-0">
                <DialogHeader className="p-6 pb-0">
                  <DialogTitle className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    {title} - Chat & Video
                  </DialogTitle>
                </DialogHeader>
                <div className="flex-1 p-6 pt-0">
                  {id && showChat && (
                    <EnhancedRealTimeChat roomId={id} roomTitle={title} />
                  )}
                </div>
              </DialogContent>
            </Dialog>
            
            <Button 
              size="sm" 
              variant="default" 
              className="h-8 px-3 bg-gradient-to-r from-primary to-primary/80"
              onClick={joinRoom}
              disabled={isJoining}
            >
              {isJoining ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <>
                  <Video size={16} className="mr-1" />
                  Join
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DiscussionRoomCard;
