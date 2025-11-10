
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Video } from "lucide-react";
import RealTimeChat from './RealTimeChat';
import VideoChat from './VideoChat';

interface EnhancedRealTimeChatProps {
  roomId: string;
  roomTitle: string;
}

const EnhancedRealTimeChat = ({ roomId, roomTitle }: EnhancedRealTimeChatProps) => {
  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="chat" className="h-full flex flex-col">
        <TabsList className="w-full justify-start rounded-none bg-transparent border-b p-0 h-auto">
          <TabsTrigger value="chat" className="py-3 px-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none">
            <MessageSquare className="h-4 w-4 mr-2" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="video" className="py-3 px-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none">
            <Video className="h-4 w-4 mr-2" />
            Video
          </TabsTrigger>
        </TabsList>
        <TabsContent value="chat" className="flex-1 overflow-auto">
          <RealTimeChat roomId={roomId} />
        </TabsContent>
        <TabsContent value="video" className="flex-1 overflow-auto p-4">
          <VideoChat roomId={roomId} roomTitle={roomTitle} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnhancedRealTimeChat;
