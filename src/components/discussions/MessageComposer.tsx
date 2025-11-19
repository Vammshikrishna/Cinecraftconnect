import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Paperclip, Send, Smile } from 'lucide-react';
import { z } from 'zod';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

const messageSchema = z.object({
  content: z.string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message must be less than 2000 characters')
    .refine((val) => val.replace(/\s/g, '').length > 0, 'Message cannot be only whitespace'),
});

interface MessageComposerProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
  onTyping?: () => void;
  onStopTyping?: () => void;
}

export const MessageComposer = ({ onSend, disabled, onTyping, onStopTyping }: MessageComposerProps) => {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const handleSend = async () => {
    setError(null);

    try {
      messageSchema.parse({ content });
      setSending(true);
      onStopTyping?.();
      await onSend(content);
      setContent('');
      setShowEmojiPicker(false);
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

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    onTyping?.();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setContent(prevContent => prevContent + emojiData.emoji);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const charCount = content.length;
  const isNearLimit = charCount > 1800;
  const isOverLimit = charCount > 2000;

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="relative">
        {showEmojiPicker && (
            <div ref={emojiPickerRef} className="absolute bottom-full right-0 mb-2 z-10">
                <EmojiPicker onEmojiClick={handleEmojiClick} />
            </div>
        )}
        <Textarea
          value={content}
          onChange={handleContentChange}
          onKeyPress={handleKeyPress}
          onBlur={() => onStopTyping?.()}
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
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
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
