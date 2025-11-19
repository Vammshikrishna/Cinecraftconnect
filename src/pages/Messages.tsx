import { useState } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { cn } from '@/lib/utils';
import { ConversationList } from '@/components/messages/ConversationList';
import { ChatWindow } from '@/components/messages/ChatWindow';

const Messages = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  return (
    <div className="h-screen w-full flex flex-col pt-16 bg-background">
      <ResizablePanelGroup
        direction="horizontal"
        onLayout={(sizes: number[]) => {
          document.cookie = `react-resizable-panels:layout=${JSON.stringify(sizes)}`;
        }}
        className="h-full w-full"
      >
        <ResizablePanel
          defaultSize={25}
          collapsedSize={4}
          collapsible={true}
          minSize={15}
          maxSize={30}
          onCollapse={() => setIsCollapsed(true)}
          onExpand={() => setIsCollapsed(false)}
          className={cn("transition-all duration-300 ease-in-out", isCollapsed && "min-w-[50px] md:min-w-[70px]")}
        >
          <div className={cn("p-2", isCollapsed ? "p-1" : "p-4")}>
            {!isCollapsed && <h2 className="text-2xl font-bold mb-4">Conversations</h2>}
            <ConversationList 
              isCollapsed={isCollapsed}
              onSelectThread={setSelectedThreadId} 
            />
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={75}>
          {selectedThreadId ? (
            <ChatWindow threadId={selectedThreadId} />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <h3 className="text-xl font-semibold">Select a conversation</h3>
                <p className="text-muted-foreground">Start a new chat or select one from the list.</p>
              </div>
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default Messages;
