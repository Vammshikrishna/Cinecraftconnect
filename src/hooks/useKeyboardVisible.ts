import { useState, useEffect } from 'react';

/**
 * Hook to detect if the mobile keyboard is currently visible.
 * Uses the VisualViewport API for modern browsers, which accurately
 * reflects the area not covered by the keyboard.
 */
export const useKeyboardVisible = () => {
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    // Store the initial innerHeight to detect shrinkage
    const initialHeight = window.innerHeight;

    const handleResize = () => {
      // Current height can be from visualViewport or innerHeight
      const currentHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      
      // If current height is significantly smaller than initial height (e.g. > 150px difference)
      // the keyboard is likely visible.
      const isVisible = currentHeight < initialHeight - 150;
      setKeyboardVisible(isVisible);
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    } else {
      window.addEventListener('resize', handleResize);
    }

    // Fallback for focus events in case resize doesn't trigger as expected
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        setKeyboardVisible(true);
      }
    };
    
    const handleFocusOut = () => {
      // Re-run height check instead of blindly setting false
      setTimeout(handleResize, 100);
    };

    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);

    // Initial check
    handleResize();

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  return isKeyboardVisible;
};
