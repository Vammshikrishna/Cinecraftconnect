
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Copy, Check, Loader2, Edit } from "lucide-react";
import { fetchJoinRequests, approveJoinRequest, denyJoinRequest } from '@/lib/api';

interface RoomInfoPanelProps {
  roomId: string;
  roomTitle: string;
  roomDescription: string | null;
  onClose: () => void;
  onRoomUpdated: (newTitle: string, newDescription: string) => void;
}

interface Member {
  user_id: string;
  profiles: {
    username: string;
    avatar_url: string;
  } | null
}

interface JoinRequest {
  id: number;
  created_at: string;
  status: string;
  profiles: {
    user_id: string;
    username: string;
    avatar_url: string;
  } | null;
}

const RoomInfoPanel = ({ roomId, roomTitle, roomDescription, onClose, onRoomUpdated }: RoomInfoPanelProps) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [newTitle, setNewTitle] = useState(roomTitle);
  const [newDescription, setNewDescription] = useState(roomDescription || '');
  const [inviteLink, setInviteLink] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchRoomData();
  }, [roomId]);

  const fetchRoomData = async () => {
    setIsLoading(true);
    try {
        const { data: { user } } = await supabase.auth.getUser();

        const { data: roomData, error: roomError } = await supabase
            .from('discussion_rooms')
            .select('room_type, creator_id')
            .eq('id', roomId)
            .single();

        if (roomError) throw roomError;
        setIsPublic(roomData.room_type === 'public');
        if (user && roomData.creator_id === user.id) {
            setIsCreator(true);
            const requests = await fetchJoinRequests(roomId);
            setJoinRequests(requests);
        }

      const { data: membersData, error: membersError } = await supabase
        .from('room_members')
        .select(`
          user_id,
          profiles ( username, avatar_url )
        `)
        .eq('room_id', roomId);

      if (membersError) throw membersError;
      setMembers(membersData as Member[]);

    } catch (error: any) {
      toast({ title: "Error fetching room data", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (requestId: number, userId: string) => {
    try {
        await approveJoinRequest(requestId, userId, roomId);
        setJoinRequests(prev => prev.filter(req => req.id !== requestId));
        fetchRoomData(); // Refresh member list
        toast({ title: "Success", description: "Join request approved." });
    } catch (error: any) {
        toast({ title: "Error approving request", description: error.message, variant: "destructive" });
    }
  };

  const handleDeny = async (requestId: number) => {
      try {
          await denyJoinRequest(requestId);
          setJoinRequests(prev => prev.filter(req => req.id !== requestId));
          toast({ title: "Success", description: "Join request denied." });
      } catch (error: any) {
          toast({ title: "Error denying request", description: error.message, variant: "destructive" });
      }
  };

  const handleUpdateDetails = async () => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('discussion_rooms')
        .update({ title: newTitle, description: newDescription })
        .eq('id', roomId);
      if (error) throw error;
      toast({ title: "Success", description: "Room details updated successfully." });
      onRoomUpdated(newTitle, newDescription);
      setIsEditing(false);
    } catch (error: any) {
      toast({ title: "Error updating details", description: error.message, variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleCancelEdit = () => {
    setNewTitle(roomTitle);
    setNewDescription(roomDescription || '');
    setIsEditing(false);
  };

  const handlePrivacyChange = async (isPublic: boolean) => {
    setIsPublic(isPublic);
     try {
      const { error } = await supabase
        .from('discussion_rooms')
        .update({ room_type: isPublic ? 'public' : 'private' })
        .eq('id', roomId);
      if (error) throw error;
      toast({ title: "Success", description: `Room is now ${isPublic ? 'public' : 'private'}.` });
    } catch (error: any) {
      toast({ title: "Error updating privacy", description: error.message, variant: "destructive" });
    }
  }

  const generateInviteLink = () => {
    const link = `${window.location.origin}/join-room/${roomId}`;
    setInviteLink(link);
    copyToClipboard(link);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // Reset after 2s
    });
  };


  return (
    <div className="flex flex-col h-full bg-gray-800 text-white">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center p-4 border-b border-gray-700">
        <Button onClick={onClose} variant="ghost" size="icon" className="mr-4 text-gray-300 hover:text-white">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h2 className="text-xl font-bold">Room Information</h2>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex-grow flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="flex-grow p-6 overflow-y-auto">
            {/* Room Details Section */}
            <h3 className="text-lg font-semibold mb-4">Room Details</h3>
            <div className="space-y-4 pt-2">
                <div className="space-y-2">
                    <label htmlFor="room-name" className="font-medium">Room Name</label>
                    <Input id="room-name" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="bg-gray-700 border-gray-600 disabled:opacity-70" placeholder="Enter new room name" disabled={!isEditing} />
                </div>
                 <div className="space-y-2">
                    <label htmlFor="room-desc" className="font-medium">Room Description</label>
                    <Input id="room-desc" value={newDescription} onChange={e => setNewDescription(e.target.value)} className="bg-gray-700 border-gray-600 disabled:opacity-70" placeholder="Enter new room description" disabled={!isEditing} />
                </div>
                
                {isEditing ? (
                  <div className="flex gap-2 pt-2">
                      <Button onClick={handleUpdateDetails} disabled={isUpdating} className="w-full justify-center">
                        {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes
                      </Button>
                      <Button onClick={handleCancelEdit} variant="outline" className="w-full justify-center">
                        Cancel
                      </Button>
                  </div>
                ) : (
                   <Button onClick={() => setIsEditing(true)} className="w-full justify-center">
                      <Edit className="mr-2 h-4 w-4" /> Edit Details
                  </Button>
                )}
            </div>

          {/* Join Requests Section */}
          {isCreator && joinRequests.length > 0 && (
            <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4">Join Requests ({joinRequests.length})</h3>
                <div className="space-y-3">
                    {joinRequests.map(request => (
                        <div key={request.id} className="flex items-center justify-between gap-3 bg-gray-700/50 p-2 rounded-lg">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10 border-2 border-gray-600">
                                    <AvatarImage src={request.profiles?.avatar_url} alt={request.profiles?.username} />
                                    <AvatarFallback>{request.profiles?.username?.[0].toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <span className="font-medium">{request.profiles?.username}</span>
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" variant="ghost" onClick={() => handleApprove(request.id, request.profiles.user_id)}>Approve</Button>
                                <Button size="sm" variant="destructive" onClick={() => handleDeny(request.id)}>Deny</Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
           )}


          {/* Members Section */}
          <h3 className="text-lg font-semibold mt-8 mb-4">Members ({members.length})</h3>
          <div className="space-y-3">
            {members.map(member => (
              <div key={member.user_id} className="flex items-center gap-3 bg-ray-700/50 p-2 rounded-lg">
                <Avatar className="h-10 w-10 border-2 border-gray-600">
                  <AvatarImage src={member.profiles?.avatar_url} alt={member.profiles?.username} />
                  <AvatarFallback>{member.profiles?.username?.[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{member.profiles?.username}</span>
              </div>
            ))}
          </div>

          {/* Settings Section */}
          <h3 className="text-lg font-semibold mt-8 mb-4">Settings</h3>
          <div className="space-y-6">
            {/* Invite Members */}
            <div>
              <label className="font-medium mb-2 block">Invite Members</label>
              <div className="flex gap-2">
                 <Button onClick={generateInviteLink} className="w-full justify-center bg-indigo-600 hover:bg-indigo-700">
                  {isCopied ? <><Check className="h-4 w-4 mr-2"/> Copied!</> : <><Copy className="h-4 w-4 mr-2"/> Copy Invite Link</>}
                </Button>
              </div>
               {inviteLink && <p className="text-sm text-gray-400 mt-2">Link: <span className="text-indigo-400">{inviteLink}</span></p>}
            </div>

            {/* Privacy Toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
              <div>
                <label htmlFor="is-public" className="font-medium">Public Room</label>
                <p className="text-sm text-gray-400">Allows anyone with the link to join.</p>
              </div>
              <Switch id="is-public" checked={isPublic} onCheckedChange={handlePrivacyChange} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomInfoPanel;
