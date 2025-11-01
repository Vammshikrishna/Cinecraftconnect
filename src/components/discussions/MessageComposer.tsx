import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Paperclip, Send, Smile } from 'lucide-react';
import { z } from 'zod';

const messageSchema = z.object({
  content: z.string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message must be less than 2000 characters')
    .refine((val) => val.replace(/\s/g, '').length > 0, 'Message cannot be only whitespace'),
});

interface MessageComposerProps {
  onSend: (content: string, priority: string, visibilityRole: string) => Promise<void>;
  userRole: 'creator' | 'admin' | 'moderator' | 'member';
  disabled?: boolean;
}

export const MessageComposer = ({ onSend, userRole, disabled }: MessageComposerProps) => {
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<string>('normal');
  const [visibilityRole, setVisibilityRole] = useState<string>('all');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSetVisibility = ['creator', 'admin', 'moderator'].includes(userRole);

  const handleSend = async () => {
    setError(null);

    try {
      // Validate message
      messageSchema.parse({ content });

      setSending(true);
      await onSend(content, priority, visibilityRole);
      
      // Reset form
      setContent('');
      setPriority('normal');
      setVisibilityRole('all');
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.issues[0].message);
      } else {
        setError('Failed to send message');
      }
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const charCount = content.length;
  const isNearLimit = charCount > 1800;
  const isOverLimit = charCount > 2000;

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-sm mb-1 block">Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High Priority</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {canSetVisibility && (
          <div className="flex-1">
            <Label className="text-sm mb-1 block">Visible to</Label>
            <Select value={visibilityRole} onValueChange={setVisibilityRole}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                <SelectItem value="moderator">Moderators+</SelectItem>
                <SelectItem value="admin">Admins Only</SelectItem>
                <SelectItem value="creator">Creator Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="relative">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message... (Shift+Enter for new line)"
          className="min-h-[80px] pr-24 resize-none"
          disabled={disabled || sending}
        />
        <div className="absolute bottom-2 right-2 flex gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            disabled
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            disabled
          >
            <Smile className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {charCount}/2000 characters
          {isNearLimit && !isOverLimit && (
            <span className="text-amber-500 ml-2">Approaching limit</span>
          )}
          {isOverLimit && (
            <span className="text-destructive ml-2">Character limit exceeded</span>
          )}
        </div>
        <Button
          onClick={handleSend}
          disabled={disabled || sending || content.trim().length === 0 || isOverLimit}
          className="gap-2"
        >
          <Send className="h-4 w-4" />
          Send
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
};
