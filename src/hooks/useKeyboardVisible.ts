import { useState, useEffect } from 'react';

/**
 * Hook to detect if the mobile keyboard is currently visible.
 * Uses the VisualViewport API for modern browsers, which accurately
 * reflects the area not covered by the keyboard.
 */
export const useKeyboardVisible = () => {
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    // Some older browsers might not support visualViewport
    if (!window.visualViewport) {
      const handleFocusIn = (e: FocusEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          setKeyboardVisible(true);
        }
      };
      
      const handleFocusOut = () => {
        setKeyboardVisible(false);
      };

      window.addEventListener('focusin', handleFocusIn);
      window.addEventListener('focusout', handleFocusOut);
      return () => {
        window.removeEventListener('focusin', handleFocusIn);
        window.removeEventListener('focusout', handleFocusOut);
      };
    }

    const handleResize = () => {
      if (window.visualViewport) {
        // If viewport height is significantly smaller than window height, keyboard is open
        // A threshold of 0.8 is usually safe to detect the keyboard
        const isVisible = window.visualViewport.height < window.innerHeight * 0.8;
        setKeyboardVisible(isVisible);
      }
    };

    window.visualViewport.addEventListener('resize', handleResize);
    // Initial check
    handleResize();

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  }, []);

  return isKeyboardVisible;
};
