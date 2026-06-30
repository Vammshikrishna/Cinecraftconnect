const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/discussions/DiscussionChatInterface.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Import Smile and add QUICK_REACTIONS
if (!content.includes('Smile')) {
    content = content.replace("ShieldBan, Flag, Lock", "ShieldBan, Flag, Lock, Smile");
}

if (!content.includes('const QUICK_REACTIONS')) {
    content = content.replace("const getUserColor = (userId: string) => {", "const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '🙏', '👍'];\n\nconst getUserColor = (userId: string) => {");
}

// 2. Add MessageReaction interface and reactions to Message in types.ts or directly in the file if it defines Message
// Wait, DiscussionChatInterface imports Message from './types'. Let's check if we can augment it locally.
// Actually, it's better to update src/components/discussions/types.ts directly for the Message interface there.
// We'll do that separately.

// 3. Add reactionLocksRef in the component
if (!content.includes('reactionLocksRef')) {
    content = content.replace("const messagesEndRef = useRef<HTMLDivElement>(null);", "const messagesEndRef = useRef<HTMLDivElement>(null);\n  const reactionLocksRef = useRef<Set<string>>(new Set());");
}

// 4. Add fetchReactions function
if (!content.includes('fetchReactions')) {
    content = content.replace("const processMessages = async (msgs: any[]) => {", `const fetchReactions = async (msgs: any[]) => {
    const msgIds = msgs.map(m => m.id);
    if (msgIds.length === 0) return msgs;
    
    const { data, error } = await supabase
      .from('room_message_reactions')
      .select('*, profiles:user_id(full_name, avatar_url)')
      .in('message_id', msgIds);
      
    if (error) {
      console.error('Error fetching reactions:', error);
      return msgs;
    }
    
    const reactionsMap: Record<string, any[]> = {};
    (data || []).forEach(r => {
      if (!reactionsMap[r.message_id]) reactionsMap[r.message_id] = [];
      reactionsMap[r.message_id].push({
        id: r.id,
        message_id: r.message_id,
        user_id: r.user_id,
        emoji: r.emoji,
        created_at: r.created_at,
        user_profile: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
      });
    });
    
    return msgs.map(m => ({
      ...m,
      reactions: reactionsMap[m.id] || []
    }));
  };

  const processMessages = async (msgs: any[]) => {`);
}

// 5. Apply fetchReactions in fetchMessages and loadMoreMessages
content = content.replace("const sortedMessages = await processMessages(sorted);", "const sortedMessages = await processMessages(sorted);\n      const withReactions = await fetchReactions(sortedMessages);");
content = content.replace("sortedMessages.forEach(m => messagesMap.set(m.id, m));", "withReactions.forEach(m => messagesMap.set(m.id, m));");
content = content.replace("const sortedNewMessages = await processMessages(rawSorted);", "const sortedNewMessages = await processMessages(rawSorted);\n        const withReactions = await fetchReactions(sortedNewMessages);");
content = content.replace("setMessages(prev => [...sortedNewMessages, ...prev]);", "setMessages(prev => [...withReactions, ...prev]);");

// 6. Handle real-time reactions and add handleReactionChange
if (!content.includes('handleReactionChange')) {
    content = content.replace(/(\} else if \(payload\.eventType === 'DELETE'\) \{[\s\S]*?\}\n    \};)/, `$1

    const handleReactionChange = async (payload: any) => {
      const reaction = payload.new || payload.old;
      if (!reaction) return;
      
      if (payload.eventType === 'INSERT') {
        const { data: profile } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', reaction.user_id).maybeSingle();
        setMessages((prev: any[]) => {
          const idx = prev.findIndex(m => m.id === reaction.message_id);
          if (idx === -1) return prev;
          const updated = [...prev];
          let newReactions = [...(updated[idx].reactions || [])];
          newReactions = newReactions.filter(r => r.user_id !== reaction.user_id);
          newReactions.push({ ...reaction, user_profile: profile || undefined });
          updated[idx] = { ...updated[idx], reactions: newReactions };
          return updated;
        });
      } else if (payload.eventType === 'DELETE') {
        setMessages((prev: any[]) => {
          const updated = [...prev];
          if (reaction.message_id && reaction.user_id) {
            const idx = updated.findIndex(m => m.id === reaction.message_id);
            if (idx !== -1) {
              updated[idx] = { ...updated[idx], reactions: (updated[idx].reactions || []).filter((r: any) => r.user_id !== reaction.user_id) };
            }
          } else {
            const idx = updated.findIndex(m => m.reactions?.some((r: any) => r.id === reaction.id));
            if (idx !== -1) {
              updated[idx] = { ...updated[idx], reactions: (updated[idx].reactions || []).filter((r: any) => r.id !== reaction.id) };
            }
          }
          return updated;
        });
      }
    };`);
}

// 7. Subscribe to reactions changes and broadcast
if (!content.includes(`table: 'room_message_reactions'`)) {
    content = content.replace(/\.on\('postgres_changes', \{ \n          event: 'DELETE', \n          schema: 'public', \n          table: 'room_messages'\n        \}, handleRoomMessageChange\)/, 
    `.on('postgres_changes', { 
          event: 'DELETE', 
          schema: 'public', 
          table: 'room_messages'
        }, handleRoomMessageChange)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'room_message_reactions'
        }, handleReactionChange)
        .on('broadcast', { event: 'reaction_update' }, (payload) => {
          handleReactionChange(payload.payload);
        })`);
}

// 8. Add handleToggleReaction function
if (!content.includes('handleToggleReaction')) {
    content = content.replace("const loadMoreMessages = async () => {", `const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    
    if (reactionLocksRef.current.has(messageId)) return;
    reactionLocksRef.current.add(messageId);
    
    try {
      let currentReactions: any[] = [];
      setMessages((prev: any[]) => {
        const msg = prev.find(m => m.id === messageId);
        if (msg) currentReactions = msg.reactions || [];
        return prev;
      });
      
      const existingReaction = currentReactions.find(r => r.emoji === emoji && r.user_id === user.id);
      const isTogglingOff = !!existingReaction;

      const optimisticId = \`temp-react-\${Date.now()}\`;
      setMessages((prev: any[]) => {
        const idx = prev.findIndex(m => m.id === messageId);
        if (idx === -1) return prev;
        const updated = [...prev];
        let newReactions = [...(updated[idx].reactions || [])].filter((r: any) => r.user_id !== user.id);
        
        if (!isTogglingOff) {
          newReactions.push({
             id: optimisticId,
             message_id: messageId,
             user_id: user.id,
             emoji: emoji,
             created_at: new Date().toISOString(),
             user_profile: profileRef.current ? { full_name: profileRef.current.full_name || '', avatar_url: profileRef.current.avatar_url || '' } : undefined
          });
        }
        updated[idx] = { ...updated[idx], reactions: newReactions };
        return updated;
      });

      if (channelRef.current) {
         channelRef.current.send({
            type: 'broadcast',
            event: 'reaction_update',
            payload: { 
               eventType: isTogglingOff ? 'DELETE' : 'INSERT', 
               [isTogglingOff ? 'old' : 'new']: isTogglingOff ? existingReaction : { id: optimisticId, message_id: messageId, user_id: user.id, emoji }
            }
         }).catch(console.error);
      }

      await supabase.from('room_message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id);

      if (!isTogglingOff) {
        const { data, error } = await supabase.from('room_message_reactions').insert({
          message_id: messageId,
          user_id: user.id,
          emoji: emoji
        }).select().single();
        
        if (error) {
          console.error('Error adding reaction', error);
          setMessages((prev: any[]) => {
            const idx = prev.findIndex(m => m.id === messageId);
            if (idx === -1) return prev;
            const updated = [...prev];
            updated[idx] = { ...updated[idx], reactions: currentReactions };
            return updated;
          });
        } else if (data) {
          setMessages((prev: any[]) => {
             const idx = prev.findIndex(m => m.id === messageId);
             if (idx === -1) return prev;
             const updated = [...prev];
             updated[idx] = { ...updated[idx], reactions: (updated[idx].reactions || []).map((r: any) => r.id === optimisticId ? { ...r, id: data.id } : r) };
             return updated;
          });
        }
      }
    } finally {
      reactionLocksRef.current.delete(messageId);
    }
  };

  const loadMoreMessages = async () => {`);
}

// 9. Render Reactions and Reaction button in UI
const reactionUiRegex = /<div className=\{`absolute top-1\/2 -translate-y-1\/2 \$\{isOwn \? 'right-full mr-2' : 'left-full ml-2'\} opacity-0 group-hover:opacity-100 transition-opacity z-10`\}>/;
if (content.match(reactionUiRegex)) {
    content = content.replace(reactionUiRegex, `{message.reactions && message.reactions.length > 0 && (
                        <div className={\`flex flex-wrap gap-1 mt-1 \${isOwn ? 'justify-end' : 'justify-start'}\`}>
                          {Array.from(new Set(message.reactions.map((r: any) => r.emoji))).map((emoji: any) => {
                             const emojiReactions = message.reactions!.filter((r: any) => r.emoji === emoji);
                             const count = emojiReactions.length;
                             const hasReacted = emojiReactions.some((r: any) => r.user_id === user?.id);
                             
                             return (
                               <button 
                                  key={emoji}
                                  onClick={() => handleToggleReaction(message.id, emoji)}
                                  className={cn("flex items-center gap-0.5 px-1 rounded-full text-[11px] hover:bg-muted transition-colors bg-background/50 border border-border/50", hasReacted && "bg-primary/10 text-primary border-primary/20")}
                               >
                                 <span>{emoji}</span>
                                 {count > 1 && <span className="text-[9px] font-bold">{count}</span>}
                               </button>
                             );
                          })}
                        </div>
                      )}

                      <div className={\`absolute top-1/2 -translate-y-1/2 \${isOwn ? 'right-full mr-2' : 'left-full ml-2'} opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center gap-0.5\`}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 text-muted-foreground hover:bg-muted rounded-full transition-colors">
                              <Smile className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={isOwn ? 'end' : 'start'} className="w-fit p-1.5 flex items-center gap-1 rounded-full border-border/50 shadow-xl bg-background/95 backdrop-blur-xl">
                              {QUICK_REACTIONS.map(emoji => (
                                <button 
                                  key={emoji}
                                  onClick={() => handleToggleReaction(message.id, emoji)} 
                                  className="hover:scale-125 transition-transform text-lg p-1.5 leading-none"
                                >
                                  {emoji}
                                </button>
                              ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
`);
}

// Add double-click to heart
content = content.replace(/<div className=\{`flex mb-3 items-end group \$\{isOwn \? 'justify-end' : ''\}`\}>/g, 
  `<div className={\`flex mb-3 items-end group \${isOwn ? 'justify-end' : ''}\`} onDoubleClick={() => handleToggleReaction(message.id, '❤️')}>`);


fs.writeFileSync(filePath, content);
console.log('DiscussionChatInterface.tsx updated successfully');
