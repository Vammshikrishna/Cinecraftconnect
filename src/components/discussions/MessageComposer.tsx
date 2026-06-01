import { useState, useRef, useEffect } from 'react';
import { useKeyboard } from '@/contexts/KeyboardContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Paperclip, Send, Smile, Keyboard, Video as VideoIcon, X, Loader2 } from 'lucide-react';
import { z } from 'zod';
import EmojiPicker, { EmojiClickData, EmojiStyle, Theme as EmojiTheme } from 'emoji-picker-react';

const messageSchema = z.object({
  content: z.string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message must be less than 2000 characters')
    .refine((val) => val.replace(/\s/g, '').length > 0, 'Message cannot be only whitespace'),
});

interface MessageComposerProps {
  onSend: (content: string, file?: File | null) => Promise<void>;
  disabled?: boolean;
  onTyping?: () => void;
  onStopTyping?: () => void;
  userRole?: string;
  isUploading?: boolean;
}

export const MessageComposer = ({ onSend, disabled, onTyping, onStopTyping, isUploading }: MessageComposerProps) => {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const { isEmojiPickerOpen: showEmojiPicker, setIsEmojiPickerOpen: setShowEmojiPicker, keyboardHeight } = useKeyboard();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sendingRef = useRef(false);

  // Kill any auto-focus on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (textareaRef.current && document.activeElement === textareaRef.current) {
        textareaRef.current.blur();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSend = async () => {
    if (!content.trim() && !selectedFile) return;
    if (sendingRef.current) return;
    
    const sentContent = content;
    const sentFile = selectedFile;
    
    setError(null);
    try {
      if (content.trim()) {
        messageSchema.parse({ content });
      }
      sendingRef.current = true;
      setSending(true);
      onStopTyping?.();
      
      // Clear instantly for perfect perceived performance (Zero-latency UI)
      setContent('');
      setSelectedFile(null);
      setMediaPreview(null);
      
      await onSend(sentContent, sentFile);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.issues[0].message);
      } else {
        setError('Failed to send message');
      }
      // Restore input on failure
      setContent(sentContent);
      setSelectedFile(sentFile);
    } finally {
      sendingRef.current = false;
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

  const openEmojiPanel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    textareaRef.current?.blur();
    setTimeout(() => {
      setShowEmojiPicker(true);
    }, 150);
  };

  const openKeyboard = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    textareaRef.current?.focus();
    setTimeout(() => {
      setShowEmojiPicker(false);
    }, 200);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        setError("File size exceeds 50MB limit");
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setMediaPreview(null);
  };

  const handleInputFocus = () => {
    if (showEmojiPicker) {
      setTimeout(() => setShowEmojiPicker(false), 200);
    }
  };

  const charCount = content.length;
  const isNearLimit = charCount > 1800;
  const isOverLimit = charCount > 2000;

  return (
    <div className="bg-background">
      {mediaPreview && (
        <div className="px-4 py-3 bg-muted/30 border-t border-border/50 animate-in slide-in-from-bottom-2">
          <div className="relative inline-block group">
            {selectedFile?.type.startsWith('image/') ? (
              <img
                src={mediaPreview}
                alt="Preview"
                className="h-24 w-24 object-cover rounded-xl border-2 border-primary/20 shadow-lg"
              />
            ) : (
              <div className="h-24 w-24 bg-primary/10 rounded-xl flex flex-col items-center justify-center border-2 border-primary/20 shadow-lg">
                <VideoIcon className="h-8 w-8 text-primary mb-1" />
                <span className="text-[10px] font-bold uppercase tracking-tighter opacity-60">Video</span>
              </div>
            )}
            <button
              onClick={clearSelectedFile}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors z-10"
            >
              <X className="h-3 w-3" />
            </button>
            <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <span className="text-[10px] font-black text-white uppercase tracking-widest">{Math.round(selectedFile!.size / 1024)}KB</span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-2 px-2 text-xs text-destructive flex items-center gap-1">
          <span>{error}</span>
        </div>
      )}

      <div className={cn(
        "flex items-end gap-2 px-2 bg-background py-1.5",
        showEmojiPicker && "pb-0"
      )}>
        <div className="flex gap-0.5 pb-0.5 shrink-0">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            <Paperclip className="h-5 w-5" />
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileSelect}
            />
          </Button>

          {showEmojiPicker ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 rounded-full text-primary bg-primary/10"
              onClick={openKeyboard}
            >
              <Keyboard className="h-5 w-5" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted emoji-toggle-button"
              onClick={openEmojiPanel}
            >
              <Smile className="h-5 w-5" />
            </Button>
          )}
        </div>

        <div className="flex-1 relative bg-muted/50 rounded-2xl border border-transparent focus-within:border-primary/20 focus-within:bg-background transition-all">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onKeyPress={handleKeyPress}
            onFocus={handleInputFocus}
            onBlur={() => onStopTyping?.()}
            placeholder="Message..."
            className="min-h-[40px] max-h-[120px] py-2.5 px-4 bg-transparent border-none shadow-none focus-visible:ring-0 resize-none text-sm sm:text-base w-full"
            disabled={disabled || sending}
            rows={1}
          />
        </div>

        <Button
          onClick={handleSend}
          disabled={disabled || sending || isUploading || (content.trim().length === 0 && !selectedFile) || isOverLimit}
          size="icon"
          className="h-10 w-10 rounded-full shrink-0 shadow-sm mb-0.5"
        >
          {sending || isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 ml-0.5" />}
        </Button>
      </div>

      {(isNearLimit || isOverLimit) && (
        <div className="text-[10px] text-right px-2 text-muted-foreground">
          {charCount}/2000
          {isOverLimit && <span className="text-destructive ml-1">Limit exceeded</span>}
        </div>
      )}

      <div
        className={cn(
          "w-full bg-[#161618] border-t border-border overflow-hidden transition-all duration-300",
          showEmojiPicker ? "block animate-in slide-in-from-bottom" : "hidden"
        )}
        style={{
          height: `calc(${keyboardHeight}px + env(safe-area-inset-bottom, 0px))`,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}
      >
        <EmojiPicker
          onEmojiClick={handleEmojiClick}
          width="100%"
          height={keyboardHeight}
          emojiStyle={EmojiStyle.APPLE}
          theme={EmojiTheme.DARK}
          lazyLoadEmojis={false}
          previewConfig={{ showPreview: false }}
          searchDisabled={false}
          autoFocusSearch={false}
          skinTonesDisabled={true}
        />
      </div>
    </div>
  );
};
