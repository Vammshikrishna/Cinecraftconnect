import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface KeyboardContextType {
  isKeyboardVisible: boolean;
  isEmojiPickerOpen: boolean;
  setIsEmojiPickerOpen: (open: boolean) => void;
  keyboardHeight: number;
}

const KeyboardContext = createContext<KeyboardContextType>({
  isKeyboardVisible: false,
  isEmojiPickerOpen: false,
  setIsEmojiPickerOpen: () => { },
  keyboardHeight: 300
});

export const KeyboardProvider = ({ children }: { children: ReactNode }) => {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('keyboardHeight');
      return saved ? parseInt(saved, 10) : 320;
    }
    return 320;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleViewportResize = () => {
      const viewport = window.visualViewport;
      if (!viewport) return;

      // The keyboard height is roughly the difference between innerHeight and viewport height
      // We use a threshold of 150px to distinguish keyboard from small shifts (like browser chrome)
      const diff = window.innerHeight - viewport.height;

      if (diff > 150) {
        // Add a 20px buffer to ensure it covers small gaps or suggestion bars
        const adjustedHeight = diff + 20;
        setKeyboardHeight(adjustedHeight);
        localStorage.setItem('keyboardHeight', String(adjustedHeight));
      }
    };

    window.visualViewport.addEventListener('resize', handleViewportResize);
    return () => window.visualViewport?.removeEventListener('resize', handleViewportResize);
  }, []);

  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        setIsKeyboardVisible(true);
        // If keyboard opens, emoji picker should definitely close
        setIsEmojiPickerOpen(false);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Delay to allow for handoffs (like keyboard to emoji)
        setTimeout(() => {
          if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
            setIsKeyboardVisible(false);
          }
        }, 200);
      }
    };

    // Global click listener to close emoji picker when clicking outside
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // If emoji picker is open and we click outside of it AND outside the input
      if (isEmojiPickerOpen) {
        const isEmojiPickerClick =
          target.closest('.emoji-picker-container') ||
          target.closest('aside.EmojiPickerReact') ||
          target.closest('[data-radix-popper-content-wrapper]');
        const isInputClick = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('.emoji-toggle-button');

        if (!isEmojiPickerClick && !isInputClick) {
          setIsEmojiPickerOpen(false);
          // Only blur if an input/textarea is actually focused
          const activeEl = document.activeElement;
          if (activeEl instanceof HTMLElement && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
            activeEl.blur();
          }
        }
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    document.addEventListener('mousedown', handleGlobalClick);

    // Sync body background to match emoji picker on mobile to hide safe area gaps
    if (isEmojiPickerOpen) {
      document.body.classList.add('emoji-picker-active');
    } else {
      document.body.classList.remove('emoji-picker-active');
    }

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      document.removeEventListener('mousedown', handleGlobalClick);
      document.body.classList.remove('emoji-picker-active');
    };
  }, [isEmojiPickerOpen]);

  return (
    <KeyboardContext.Provider value={{ isKeyboardVisible, isEmojiPickerOpen, setIsEmojiPickerOpen, keyboardHeight }}>
      {children}
    </KeyboardContext.Provider>
  );
};

export const useKeyboard = () => useContext(KeyboardContext);

