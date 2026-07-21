import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { useKeyboard } from './KeyboardContext';
import { useAuth } from './AuthContext';

interface NavigationContextType {
  history: string[];
  canGoBack: boolean;
  goBack: (fallback?: string) => void;
  push: (path: string, state?: any) => void;
  replace: (path: string, state?: any) => void;
  resetTo: (path: string) => void;
  lastTabPaths: Record<string, string>;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

// Internal component to handle hooks that depend on other providers
const NavigationHandler = ({ goBack, location }: { goBack: (fallback?: string) => void, location: any }) => {
  const { isEmojiPickerOpen, setIsEmojiPickerOpen } = useKeyboard();
  const { switchAccount } = useAuth();

  // Create refs to capture current values for a stable single-listener effect
  const locationRef = useRef(location);
  const goBackRef = useRef(goBack);
  const isEmojiPickerOpenRef = useRef(isEmojiPickerOpen);
  const setIsEmojiPickerOpenRef = useRef(setIsEmojiPickerOpen);
  const switchAccountRef = useRef(switchAccount);

  useEffect(() => {
    switchAccountRef.current = switchAccount;
  }, [switchAccount]);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    goBackRef.current = goBack;
  }, [goBack]);

  useEffect(() => {
    isEmojiPickerOpenRef.current = isEmojiPickerOpen;
  }, [isEmojiPickerOpen]);

  useEffect(() => {
    setIsEmojiPickerOpenRef.current = setIsEmojiPickerOpen;
  }, [setIsEmojiPickerOpen]);

  useEffect(() => {
    const listenerPromise = CapApp.addListener('backButton', () => {
      // Priority 1: Close emoji picker if open
      if (isEmojiPickerOpenRef.current) {
        setIsEmojiPickerOpenRef.current(false);
        return;
      }

      // Priority 2: Blur active input/textarea to hide the keyboard
      const activeEl = document.activeElement;
      if (activeEl instanceof HTMLElement && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        activeEl.blur();
        return;
      }

      // Priority 3: Close open modals, dialogs, drawers, dropdowns, sheet overlays, listboxes, popovers
      // Using selectors matching standard Radix/Vaul elements
      const activeModal = document.querySelector('[role="dialog"], [role="menu"], [role="listbox"], [data-radix-portal], .dialog-content');
      if (activeModal) {
        // Dispatch synthetic Escape key event to close the modal
        const event = new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          keyCode: 27,
          which: 27,
          bubbles: true,
          cancelable: true
        });
        document.dispatchEvent(event);
        return;
      }

      // Priority 4: Exit app if at root/landing pages
      const pathname = locationRef.current.pathname;
      const search = locationRef.current.search;

      if (pathname === '/auth') {
        const queryParams = new URLSearchParams(search);
        const prevUserId = queryParams.get('previous_user_id');
        if (prevUserId) {
          switchAccountRef.current(prevUserId);
          return;
        }
      }

      if (pathname === '/feed' || pathname === '/' || pathname === '/auth') {
        CapApp.exitApp();
      } else {
        // Priority 5: Normal back navigation
        goBackRef.current();
      }
    });

    return () => {
      listenerPromise.then(l => l.remove());
    };
  }, []);

  return null;
};

export const NavigationProvider = ({ children }: { children: React.ReactNode }) => {
  const [historyStack, setHistoryStack] = useState<string[]>([]);
  const [lastTabPaths, setLastTabPaths] = useState<Record<string, string>>({});
  const location = useLocation();
  const navigate = useNavigate();
  const navType = useNavigationType();
  const isInternalNav = useRef(false);

  // Identify main tabs
  const MAIN_TABS = ['/feed', '/projects', '/discussion-rooms', '/jobs', '/network', '/ratings', '/announcements', '/pages', '/messages'];

  useEffect(() => {
    const currentPath = location.pathname;
    
    // Track last visited path for each tab
    const activeTab = MAIN_TABS.find(tab => currentPath.startsWith(tab));
    if (activeTab) {
      setLastTabPaths(prev => ({
        ...prev,
        [activeTab]: currentPath
      }));
    }

    // Track history stack
    if (navType === 'PUSH') {
      setHistoryStack(prev => [...prev, currentPath]);
    } else if (navType === 'POP') {
      setHistoryStack(prev => prev.slice(0, -1));
    } else if (navType === 'REPLACE' && !isInternalNav.current) {
      setHistoryStack(prev => {
        const newStack = [...prev];
        if (newStack.length > 0) newStack[newStack.length - 1] = currentPath;
        return newStack;
      });
    }
    
    isInternalNav.current = false;
  }, [location.pathname, navType]);

  const goBack = useCallback((fallback?: string) => {
    if (historyStack.length > 0) {
      navigate(-1);
    } else if (fallback) {
      navigate(fallback, { replace: true });
    } else {
      // Smart Fallback Strategy
      const path = location.pathname;
      if (path.includes('/projects/')) navigate('/projects', { replace: true });
      else if (path.includes('/discussion-rooms/')) navigate('/discussion-rooms', { replace: true });
      else if (path.includes('/jobs/')) navigate('/jobs', { replace: true });
      else if (path.includes('/dm/') || path.includes('/messages/')) navigate('/messages', { replace: true });
      else if (path.includes('/pages/')) navigate('/pages', { replace: true });
      else if (path.includes('/marketplace/')) navigate('/marketplace', { replace: true });
      else if (path.includes('/vendors/')) navigate('/vendors', { replace: true });
      else navigate('/feed', { replace: true });
    }
  }, [historyStack, navigate, location.pathname]);

  const push = useCallback((path: string, state?: any) => {
    isInternalNav.current = true;
    navigate(path, { state });
  }, [navigate]);

  const replace = useCallback((path: string, state?: any) => {
    isInternalNav.current = true;
    navigate(path, { replace: true, state });
  }, [navigate]);

  const resetTo = useCallback((path: string) => {
    setHistoryStack([]);
    navigate(path, { replace: true });
  }, [navigate]);

  return (
    <NavigationContext.Provider value={{ 
      history: historyStack, 
      canGoBack: historyStack.length > 0, 
      goBack, 
      push, 
      replace, 
      resetTo,
      lastTabPaths
    }}>
      <NavigationHandler goBack={goBack} location={location} />
      {children}
    </NavigationContext.Provider>
  );
};

export const useAppNavigation = () => {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useAppNavigation must be used within a NavigationProvider');
  }
  return context;
};
