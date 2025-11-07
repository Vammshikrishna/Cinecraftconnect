import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Users, Search } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const fetchConversations = async (userId: string) => {
    const { data, error } = await supabase
        .rpc('get_user_conversations_with_profiles', { p_user_id: userId });

    if (error) {
        throw new Error(error.message);
    }
    return data;
};

const ChatsList = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');

    const { data: conversations, isLoading, isError, error } = useQuery({
        queryKey: ['conversations', user?.id],
        queryFn: () => fetchConversations(user!.id),
        enabled: !!user,
    });

    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel('public:messages')
            .on('postgres_changes', 
                { event: 'INSERT', schema: 'public', table: 'messages' }, 
                () => {
                    queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, queryClient]);

    const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    const filteredConversations = conversations?.filter(convo =>
        convo.other_user_full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        convo.other_user_username?.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];


    return (
        <div className='container mx-auto px-4 py-8 md:py-12'>
            <Card className='max-w-4xl mx-auto bg-card/80 backdrop-blur-sm border-border'>
                <CardHeader>
                    <CardTitle className='text-2xl font-bold text-foreground'>Chat</CardTitle>
                    <CardDescription>Stay connected with your network</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className='mb-6'>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                            <Input
                                type="text"
                                placeholder="Search conversations..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 bg-background/50 border-border"
                            />
                        </div>
                    </div>

                    {isLoading ? (
                        <div className='text-center py-12'><LoadingSpinner /></div>
                    ) : isError ? (
                        <div className='text-center py-12 text-destructive'>Error: {error.message}</div>
                    ) : conversations && conversations.length === 0 ? (
                        <div className='text-center py-16 px-6 bg-background/30 rounded-lg'>
                            <MessageSquare className='h-16 w-16 mx-auto text-muted-foreground mb-4' />
                            <h3 className='text-xl font-semibold text-foreground'>No conversations yet</h3>
                            <p className='text-muted-foreground mt-2 mb-6'>Start networking and send your first message!</p>
                            <Button onClick={() => navigate('/network/discover')} className='btn-primary'>
                                <Users className='h-4 w-4 mr-2' />
                                Find Connections
                            </Button>
                        </div>
                    ) : filteredConversations.length === 0 ? (
                        <div className='text-center py-16 px-6'><p className='text-muted-foreground'>No conversations match your search.</p></div>
                    ) : (
                        <div className='space-y-2'>
                            {filteredConversations.map(convo => (
                                <Link to={`/chat/${convo.conversation_id}`} key={convo.conversation_id} className='block hover:bg-muted/50 rounded-lg transition-colors p-3 border border-transparent hover:border-border'>
                                    <div className='flex items-center gap-4'>
                                        <Avatar className='h-12 w-12 border-2 border-primary/50'>
                                            <AvatarImage src={convo.other_user_avatar_url || undefined} alt={convo.other_user_full_name || 'User'} />
                                            <AvatarFallback className='bg-primary/20 text-primary font-semibold'>
                                                {getInitials(convo.other_user_full_name || convo.other_user_username || 'U')}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className='flex-grow overflow-hidden'>
                                            <div className='flex justify-between items-start'>
                                                <h4 className='font-semibold text-foreground truncate'>
                                                    {convo.other_user_full_name || convo.other_user_username}
                                                </h4>
                                                {convo.last_message_created_at && (
                                                    <p className='text-xs text-muted-foreground flex-shrink-0 ml-2'>
                                                        {formatDistanceToNow(new Date(convo.last_message_created_at), { addSuffix: true })}
                                                    </p>
                                                )}
                                            </div>
                                            <p className='text-sm text-primary'>{convo.other_user_craft}</p>
                                            <p className='text-sm text-muted-foreground truncate mt-1'>
                                                {convo.last_message_content ? 
                                                    (convo.last_message_sender_id === user?.id ? 'You: ' : '') + convo.last_message_content
                                                    : <span className='italic'>No messages yet.</span>
                                                }
                                            </p>
                                        </div>
                                        {convo.unread_count > 0 && (
                                            <div className='w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0'>
                                                {convo.unread_count}
                                            </div>
                                        )}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default ChatsList;
