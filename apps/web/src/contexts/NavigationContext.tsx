import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
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

const NavigationHandler = ({ goBack }: { goBack: (fallback?: string) => void; location: any }) => {
  const { isEmojiPickerOpen, setIsEmojiPickerOpen } = useKeyboard();

  const isEmojiPickerOpenRef = useRef(isEmojiPickerOpen);
  const setIsEmojiPickerOpenRef = useRef(setIsEmojiPickerOpen);

  useEffect(() => {
    isEmojiPickerOpenRef.current = isEmojiPickerOpen;
  }, [isEmojiPickerOpen]);

  useEffect(() => {
    setIsEmojiPickerOpenRef.current = setIsEmojiPickerOpen;
  }, [setIsEmojiPickerOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEmojiPickerOpenRef.current) {
          setIsEmojiPickerOpenRef.current(false);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
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

  const MAIN_TABS = ['/feed', '/projects', '/discussion-rooms', '/jobs', '/network', '/ratings', '/announcements', '/pages', '/messages'];

  useEffect(() => {
    const currentPath = location.pathname;
    
    const activeTab = MAIN_TABS.find(tab => currentPath.startsWith(tab));
    if (activeTab) {
      setLastTabPaths(prev => ({
        ...prev,
        [activeTab]: currentPath
      }));
    }

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
      const path = location.pathname;
      if (path.includes('/projects/')) navigate('/projects', { replace: true });
      else if (path.includes('/discussion-rooms/')) navigate('/discussion-rooms', { replace: true });
      else if (path.includes('/jobs/')) navigate('/jobs', { replace: true });
      else if (path.includes('/dm/') || path.includes('/messages/')) navigate('/messages', { replace: true });
      else if (path.includes('/pages/')) navigate('/pages', { replace: true });
      else if (path.includes('/marketplace/')) navigate('/marketplace', { replace: true });
      else if (path.includes('/vendors/')) navigate('/marketplace?tab=services', { replace: true });
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
