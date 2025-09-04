
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import DiscussionRoomCard from "./DiscussionRoomCard";

interface DiscussionRoom {
  id: string;
  title: string;
  description: string;
  creator_id: string;
  member_count: number;
  is_active: boolean;
  room_type: string;
  created_at: string;
}

const DiscussionRoomsTab = () => {
  const [rooms, setRooms] = useState<DiscussionRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState("");
  const [newRoomDescription, setNewRoomDescription] = useState("");
  const { toast } = useToast();

  // Fetch discussion rooms
  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('discussion_rooms')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRooms(data || []);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast({
        title: "Error",
        description: "Failed to load discussion rooms",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Create new discussion room
  const createRoom = async () => {
    if (!newRoomTitle.trim() || !newRoomDescription.trim()) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to create discussion rooms",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('discussion_rooms')
        .insert([
          {
            title: newRoomTitle,
            description: newRoomDescription,
            creator_id: user.id,
          }
        ]);

      if (error) throw error;

      // Get the created room ID and join as creator
      const { data: roomData } = await supabase
        .from('discussion_rooms')
        .select('id')
        .eq('title', newRoomTitle)
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (roomData) {
        await supabase
          .from('room_members')
          .insert([
            {
              room_id: roomData.id,
              user_id: user.id,
              role: 'creator'
            }
          ]);
      }

      setNewRoomTitle("");
      setNewRoomDescription("");
      setShowCreateForm(false);
      fetchRooms();
      toast({
        title: "Success",
        description: "Discussion room created successfully!",
      });
    } catch (error) {
      console.error('Error creating room:', error);
      toast({
        title: "Error",
        description: "Failed to create discussion room",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchRooms();

    const channel = supabase
      .channel('rooms-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'discussion_rooms'
        },
        () => {
          fetchRooms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-6">
      <h2 className="text-xl font-bold mb-4 text-gradient">Discussion Rooms</h2>
      <p className="mb-6 text-gray-300">Connect with other filmmakers in virtual rooms to discuss projects, share ideas, and collaborate.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {rooms.length === 0 ? (
          <div className="col-span-2 text-center py-8 text-gray-400">
            No active discussion rooms. Create the first one!
          </div>
        ) : (
          rooms.map((room, index) => (
            <DiscussionRoomCard 
              key={room.id}
              id={room.id}
              title={room.title}
              description={room.description}
              memberCount={room.member_count}
              members={[
                { initials: "U1", color: "bg-primary/50" },
                { initials: "U2", color: "bg-primary/70" },
                { initials: `+${Math.max(0, room.member_count - 2)}`, color: "bg-primary/80" }
              ]}
              variant={index % 2 === 0 ? "purple" : "blue"}
            />
          ))
        )}
      </div>
      
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogTrigger asChild>
          <Button className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
            Create New Discussion Room
          </Button>
        </DialogTrigger>
        <DialogContent className="bg-black/90 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Create Discussion Room</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Room title"
              value={newRoomTitle}
              onChange={(e) => setNewRoomTitle(e.target.value)}
              className="bg-black/20 border-white/10 text-white placeholder:text-gray-400"
            />
            <Textarea
              placeholder="Room description"
              value={newRoomDescription}
              onChange={(e) => setNewRoomDescription(e.target.value)}
              className="bg-black/20 border-white/10 text-white placeholder:text-gray-400"
            />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
              <Button 
                onClick={createRoom}
                className="bg-gradient-to-r from-primary to-primary/80"
              >
                Create Room
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DiscussionRoomsTab;
