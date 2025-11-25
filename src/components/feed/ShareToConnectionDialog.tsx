import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Search, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ShareToConnectionDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    postId: string;
}

interface Connection {
    id: string;
    full_name: string;
    username: string;
    avatar_url: string | null;
}

export function ShareToConnectionDialog({ isOpen, onOpenChange, postId }: ShareToConnectionDialogProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [connections, setConnections] = useState<Connection[]>([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState<string | null>(null); // ID of user being sent to
    const [sentTo, setSentTo] = useState<Set<string>>(new Set());
    const { user } = useAuth();
    const { toast } = useToast();

    useEffect(() => {
        if (isOpen && user) {
            fetchConnections();
        }
    }, [isOpen, user]);

    const fetchConnections = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Fetch recent conversations as "connections"
            const { data, error } = await supabase.rpc('get_user_conversations_with_profiles' as any, { p_user_id: user.id });

            if (error) throw error;

            if (data) {
                const uniqueConnections = new Map();
                data.forEach((c: any) => {
                    if (!uniqueConnections.has(c.other_user_id)) {
                        uniqueConnections.set(c.other_user_id, {
                            id: c.other_user_id,
                            full_name: c.other_user_full_name,
                            username: '', // RPC doesn't return username, but full_name is enough for display
                            avatar_url: c.other_user_avatar_url
                        });
                    }
                });
                setConnections(Array.from(uniqueConnections.values()));
            }
        } catch (error) {
            console.error("Error fetching connections:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async (recipientId: string) => {
        if (!user) return;
        setSending(recipientId);

        try {
            const channelId = [user.id, recipientId].sort().join('-');
            const postLink = `${window.location.origin}/feed?post=${postId}`;
            const messageContent = `Check out this post: ${postLink}`;

            const { error } = await supabase.from('direct_messages' as any).insert({
                content: messageContent,
                sender_id: user.id,
                channel_id: channelId,
                recipient_id: recipientId
            });

            if (error) throw error;

            setSentTo(prev => new Set(prev).add(recipientId));
            toast({
                title: "Sent",
                description: "Post shared successfully.",
            });
        } catch (error) {
            console.error("Error sending message:", error);
            toast({
                title: "Error",
                description: "Failed to share post.",
                variant: "destructive"
            });
        } finally {
            setSending(null);
        }
    };

    const filteredConnections = connections.filter(c =>
        c.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px] bg-card text-card-foreground border-border">
                <DialogHeader>
                    <DialogTitle>Send to Connection</DialogTitle>
                </DialogHeader>

                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                        placeholder="Search connections..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>

                <div className="max-h-[300px] overflow-y-auto space-y-2">
                    {loading ? (
                        <div className="text-center py-4 text-gray-400">Loading connections...</div>
                    ) : filteredConnections.length === 0 ? (
                        <div className="text-center py-4 text-gray-400">No connections found</div>
                    ) : (
                        filteredConnections.map((connection) => (
                            <div key={connection.id} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg transition-colors">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={connection.avatar_url || undefined} />
                                        <AvatarFallback>{connection.full_name?.[0] || 'U'}</AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium">{connection.full_name}</span>
                                </div>

                                {sentTo.has(connection.id) ? (
                                    <Button variant="ghost" size="sm" disabled className="text-green-500">
                                        <Check className="h-4 w-4 mr-1" /> Sent
                                    </Button>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        disabled={sending === connection.id}
                                        onClick={() => handleSend(connection.id)}
                                    >
                                        {sending === connection.id ? "Sending..." : "Send"}
                                    </Button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
