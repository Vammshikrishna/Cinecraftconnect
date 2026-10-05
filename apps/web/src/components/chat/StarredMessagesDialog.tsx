import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Star, Search, Trash2, ArrowUpRight } from 'lucide-react';
import { format } from 'date-fns';

interface StarredMessagesDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  starredMessages: any[];
  onJumpToMessage?: (messageId: string) => void;
  onUnstarMessage?: (messageId: string) => void;
}

export const StarredMessagesDialog: React.FC<StarredMessagesDialogProps> = ({
  isOpen,
  onOpenChange,
  starredMessages,
  onJumpToMessage,
  onUnstarMessage
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const cleanContent = (content: string) => {
    if (!content) return '';
    if (content.startsWith('FORWARDED::')) {
      return content.replace('FORWARDED::', '');
    }
    return content;
  };

  const filteredMessages = starredMessages.filter(msg => {
    const text = cleanContent(msg.content || '');
    return text.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-[92vw] sm:max-w-md rounded-2xl p-5 bg-slate-900 text-white border-2 border-slate-700 shadow-2xl z-[1000] !opacity-100"
        onClick={(e) => e.stopPropagation()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-left pb-2 border-b border-zinc-800">
          <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-white">
            <Star className="h-5 w-5 fill-amber-400 text-amber-400" /> Starred Messages
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-300">
            {starredMessages.length} starred message{starredMessages.length === 1 ? '' : 's'} in this chat
          </DialogDescription>
        </DialogHeader>

        {starredMessages.length > 0 && (
          <div className="relative my-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search starred messages..."
              className="pl-9 h-9 text-xs rounded-xl bg-zinc-900 border border-zinc-700 text-white placeholder:text-zinc-400 focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>
        )}

        <div 
          className="max-h-[60vh] sm:max-h-[320px] overflow-y-auto space-y-2 py-1 scrollbar-thin touch-pan-y overscroll-contain pr-1"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {filteredMessages.length === 0 ? (
            <div className="text-center py-10 text-xs text-zinc-400">
              {starredMessages.length === 0 ? "No starred messages yet. Long press any message and tap ⭐ to star it." : "No matching starred messages."}
            </div>
          ) : (
            filteredMessages.map(msg => {
              const displayDate = msg.created_at ? format(new Date(msg.created_at), 'MMM d, p') : '';
              const text = cleanContent(msg.content);

              return (
                <div
                  key={msg.id}
                  className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-800 transition-colors flex items-start justify-between gap-3 group"
                >
                  <div 
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => {
                      if (onJumpToMessage) onJumpToMessage(msg.id);
                      onOpenChange(false);
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                        {msg.sender_profile?.full_name || 'Message'}
                      </span>
                      <span className="text-[9px] text-zinc-400 font-mono">
                        {displayDate}
                      </span>
                    </div>

                    <p className="text-xs text-white font-medium line-clamp-2 break-words">
                      {text || (msg.attachment_url ? "Shared media attachment" : "Message")}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {onJumpToMessage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          onJumpToMessage(msg.id);
                          onOpenChange(false);
                        }}
                        className="h-7 w-7 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-700"
                        title="Jump to message"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    )}
                    {onUnstarMessage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onUnstarMessage(msg.id)}
                        className="h-7 w-7 rounded-full text-amber-500 hover:text-red-500 hover:bg-red-500/10"
                        title="Unstar"
                      >
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400 group-hover:hidden" />
                        <Trash2 className="h-4 w-4 hidden group-hover:block text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
