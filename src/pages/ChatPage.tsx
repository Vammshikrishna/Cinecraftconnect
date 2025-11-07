import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useConnections } from "@/hooks/useConnections";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import Spinner from "@/components/Spinner";
import EnhancedRealTimeChat from "@/components/chat/EnhancedRealTimeChat";
import { User } from "@supabase/supabase-js";

interface ConnectionProfile {
  id: string;
  full_name: string;
  avatar_url?: string;
}

const getOneOnOneRoomId = (userId1: string, userId2: string): string => {
  return [userId1, userId2].sort().join('');
};

const ChatPage = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const { connections, loading: connectionsLoading } = useConnections();
    const [connectionProfiles, setConnectionProfiles] = useState<ConnectionProfile[]>([]);
    const [activeConnection, setActiveConnection] = useState<ConnectionProfile | null>(null);

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUser(user);
        };
        fetchUser();
    }, []);

    useEffect(() => {
        if (!connections || !currentUser) return;

        const fetchConnectionProfiles = async () => {
            const otherUserIds = connections.map(conn => 
                conn.follower_id === currentUser.id ? conn.following_id : conn.follower_id
            );

            if (otherUserIds.length > 0) {
                const { data: profiles, error } = await supabase
                    .from('profiles')
                    .select('id, full_name, avatar_url')
                    .in('id', otherUserIds);

                if (error) {
                    console.error("Error fetching connection profiles:", error);
                } else if (profiles) {
                    setConnectionProfiles(profiles as ConnectionProfile[]);
                }
            } else {
                setConnectionProfiles([]);
            }
        };

        fetchConnectionProfiles();
    }, [connections, currentUser]);

    useEffect(() => {
        if (!activeConnection && connectionProfiles.length > 0) {
            setActiveConnection(connectionProfiles[0]);
        }
    }, [connectionProfiles, activeConnection]);

    if (connectionsLoading || !currentUser) {
        return <div className="flex h-[calc(100vh-4rem)] items-center justify-center"><Spinner /></div>;
    }
    
    const activeRoomId = activeConnection && currentUser ? getOneOnOneRoomId(currentUser.id, activeConnection.id) : null;
    const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '';

    return (
        <div className="flex h-[calc(100vh-4rem)]">
            <div className="w-1/3 border-r border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="p-4 border-b border-border">
                    <h2 className="text-xl font-bold">Direct Messages</h2>
                </div>
                <ScrollArea className="h-[calc(100%-4rem)]">
                    {connectionProfiles.length === 0 ? (
                        <p className="p-4 text-center text-muted-foreground">No connections yet. Visit the Network tab to connect with other users.</p>
                    ) : (
                        connectionProfiles.map((conn) => (
                            <div
                                key={conn.id}
                                className={cn(
                                    "flex items-center p-4 cursor-pointer hover:bg-accent transition-colors",
                                    activeConnection?.id === conn.id && "bg-accent"
                                )}
                                onClick={() => setActiveConnection(conn)}
                            >
                                <Avatar className="h-10 w-10 mr-4">
                                     <AvatarFallback>{getInitials(conn.full_name)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                    <h3 className="font-semibold">{conn.full_name}</h3>
                                    <p className="text-sm text-muted-foreground truncate">Click to open chat</p>
                                </div>
                            </div>
                        ))
                    )}
                </ScrollArea>
            </div>

            <div className="w-2/3 flex flex-col">
                {activeConnection && activeRoomId ? (
                    <EnhancedRealTimeChat
                        key={activeRoomId}
                        roomId={activeRoomId}
                        roomTitle={activeConnection.full_name}
                    />
                ) : (
                    <div className="flex-1 flex items-center justify-center bg-muted/20">
                        <div className="text-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            <h3 className="mt-2 text-lg font-medium text-foreground">Welcome to your inbox!</h3>
                            <p className="mt-1 text-sm text-muted-foreground">Select a connection to start a conversation.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatPage;
