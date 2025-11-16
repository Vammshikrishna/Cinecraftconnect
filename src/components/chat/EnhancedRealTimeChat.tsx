
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { X, LogOut, Loader2, Phone, MessageSquare } from "lucide-react";
import RealTimeChat from './RealTimeChat';
import VideoChat from './VideoChat';
import RoomInfoPanel from './RoomInfoPanel';

interface EnhancedRealTimeChatProps {
  roomId: string;
  roomTitle: string;
  roomDescription: string | null;
  onClose: () => void;
  onRoomUpdated: (roomId: string, newTitle: string, newDescription: string) => void;
}

const EnhancedRealTimeChat = ({ roomId, roomTitle, roomDescription, onClose, onRoomUpdated }: EnhancedRealTimeChatProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLeaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [currentView, setCurrentView] = useState('chat');
  const [currentTitle, setCurrentTitle] = useState(roomTitle);
  const [currentDescription, setCurrentDescription] = useState(roomDescription);

  const handleLeaveRoom = async () => {
    if (!user) {
      toast({ title: "Authentication error", description: "You must be logged in to leave a room.", variant: "destructive" });
      return;
    }
    setIsLeaving(true);
    try {
      const { error } = await supabase.from('room_members').delete().match({ room_id: roomId, user_id: user.id });
      if (error) throw error;
      toast({ title: "Success", description: `You have left the room "${currentTitle}".` });
      onClose();
    } catch (error: any) {
      toast({ title: "Error leaving room", description: error.message, variant: "destructive" });
    } finally {
      setIsLeaving(false);
      setLeaveConfirmOpen(false);
    }
  };

  const handleRoomUpdated = (newTitle: string, newDescription: string) => {
    setCurrentTitle(newTitle);
    setCurrentDescription(newDescription);
    onRoomUpdated(roomId, newTitle, newDescription);
  }

  const renderContent = () => {
    switch (currentView) {
      case 'info':
        return <RoomInfoPanel roomId={roomId} roomTitle={currentTitle} roomDescription={currentDescription} onClose={() => setCurrentView('chat')} onRoomUpdated={handleRoomUpdated} />;
      case 'video':
        return <VideoChat roomId={roomId} roomTitle={currentTitle} />;
      case 'chat':
      default:
        return (
            <div className="flex-1 overflow-auto bg-gray-900/50" style={{ backgroundImage: "url('/img/chat-bg.png')", backgroundSize: '350px', backgroundBlendMode: 'overlay' }}>
                <RealTimeChat roomId={roomId} />
            </div>
        )
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      <div className="flex-shrink-0 flex justify-between items-center p-4 pl-6 border-b border-gray-700 bg-gray-800">
        <div onClick={() => setCurrentView(currentView === 'info' ? 'chat' : 'info')} className="cursor-pointer">
          <h2 className="text-xl font-bold">{currentTitle}</h2>
          {currentDescription && (
            <p className="text-sm text-gray-400 mt-1 max-w-md truncate">{currentDescription}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
           <Button onClick={() => setCurrentView(currentView === 'video' ? 'chat' : 'video')} variant="ghost" size="icon" className="text-gray-400 hover:text-white" title={currentView === 'video' ? "Switch to Chat" : "Switch to Video Call"}>
                {currentView === 'video' ? <MessageSquare className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
            </Button>
          <Dialog open={isLeaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-red-500/80 hover:text-red-500 hover:bg-red-500/10" title="Leave Room">
                <LogOut className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-800 border-gray-700 text-white">
              <DialogHeader>
                <DialogTitle>Leave Room</DialogTitle>
                <DialogDescription className="text-gray-400 pt-2">
                  Are you sure you want to leave "{currentTitle}"? You may need to be re-invited if this is a private room.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setLeaveConfirmOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleLeaveRoom} disabled={isLeaving}>
                  {isLeaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Leave
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={onClose} variant="ghost" size="icon" className="text-gray-400 hover:text-white ml-2" title="Close">
            <X className="h-6 w-6" />
          </Button>
        </div>
      </div>
      {renderContent()}
    </div>
  );
};

export default EnhancedRealTimeChat;
