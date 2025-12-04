import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import FeedDiscussionCard from "./FeedDiscussionCard";
import { z } from "zod";
import { ResponsiveGrid } from "@/components/ui/mobile-responsive-grid";

const roomSchema = z.object({
  title: z.string()
    .trim()
    .min(1, 'Title cannot be empty')
    .max(200, 'Title must be less than 200 characters'),
  description: z.string()
    .trim()
    .min(1, 'Description cannot be empty')
    .max(2000, 'Description must be less than 2000 characters')
});

interface DiscussionRoom {
  id: string;
  title: string;
  description: string;
  creator_id: string;
  member_count: number | null;
  created_at: string;
  category_id: string | null;
}

const DiscussionRoomsTab = () => {
  const [rooms, setRooms] = useState<DiscussionRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState("");
  const [newRoomDescription, setNewRoomDescription] = useState("");
  const { toast } = useToast();

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('discussion_rooms')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRooms((data || []).map(room => ({
        ...room,
        description: room.description || '',
        creator_id: room.creator_id || '',
        category_id: room.category_id
      })));
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

  const createRoom = async () => {
    try {
      const validation = roomSchema.safeParse({
        title: newRoomTitle,
        description: newRoomDescription
      });

      if (!validation.success) {
        toast({
          title: "Validation error",
          description: validation.error.issues[0].message,
          variant: "destructive",
        });
        return;
      }

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
            title: validation.data.title,
            name: validation.data.title,
            description: validation.data.description,
            creator_id: user.id,
          }
        ]);

      if (error) throw error;

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
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xl font-semibold text-foreground">Discussion Rooms</h3>
        <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              Create Room
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">Create Discussion Room</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Room title"
                value={newRoomTitle}
                onChange={(e) => setNewRoomTitle(e.target.value)}
                className="bg-background border-input text-foreground placeholder:text-muted-foreground"
              />
              <Textarea
                placeholder="Room description"
                value={newRoomDescription}
                onChange={(e) => setNewRoomDescription(e.target.value)}
                className="bg-background border-input text-foreground placeholder:text-muted-foreground"
              />
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={createRoom}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Create Room
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {rooms.length === 0 ? (
        <div className="text-center py-8 bg-muted/20 rounded-lg flex flex-col items-center justify-center space-y-4">
          <p className="text-muted-foreground">No active discussion rooms. Create the first one!</p>
        </div>
      ) : (
        <ResponsiveGrid cols={{ sm: 1, md: 2 }} gap={4}>
          {rooms.map((room) => (
            <FeedDiscussionCard
              key={room.id}
              discussion={{
                id: room.id,
                title: room.title,
                description: room.description,
                member_count: room.member_count,
                created_at: room.created_at,
                room_type: 'public' // Assuming public for now as room_type isn't in the interface yet
              }}
            />
          ))}
        </ResponsiveGrid>
      )}
    </div>
  );
};

export default DiscussionRoomsTab;
