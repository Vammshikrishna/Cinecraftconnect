import { useState } from "react";
import { Video, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DiscussionChatInterface } from "../discussions/DiscussionChatInterface";
import { Category } from "../discussions/types";
import { InteractiveCard } from "@/components/ui/interactive-card";

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
  members,
  categoryId,
  categories
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

      const { data: existingMember } = await supabase
        .from('room_members')
        .select('id')
        .eq('room_id', id)
        .eq('user_id', user.id)
        .single();

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

  const handleRoomUpdated = (roomId: string, newTitle: string, newDescription: string) => {
    // In a real app, this would update the parent state or trigger a refetch
    console.log('Room updated:', roomId, newTitle, newDescription);
  };



  return (
    <>
      <InteractiveCard
        className="h-full flex flex-col justify-between"
        variant="hover-lift"
        title={title}
        description={description}
      >
        <div className="flex flex-col gap-4 h-full justify-between mt-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs whitespace-nowrap shrink-0">
              <Users className="w-3 h-3 mr-1" />
              {memberCount} members
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap justify-between items-center gap-y-2 mt-auto pt-4 border-t border-border/50">
          <div className="flex -space-x-2">
            {members.map((member, index) => (
              <Avatar key={index} className="h-6 w-6 border border-background ring-2 ring-background">
                <AvatarFallback className={`${member.color} text-[10px] font-medium flex items-center justify-center`}>
                  {member.initials}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          <Button
            size="sm"
            variant="default"
            className="h-8 px-3 ml-auto"
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
      </InteractiveCard>

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
