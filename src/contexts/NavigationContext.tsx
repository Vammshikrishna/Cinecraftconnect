import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { useKeyboard } from './KeyboardContext';

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

  useEffect(() => {
    const listener = CapApp.addListener('backButton', () => {
      // Priority 1: Close emoji picker if open
      if (isEmojiPickerOpen) {
        setIsEmojiPickerOpen(false);
        return;
      }

      // Priority 2: Exit app if at root
      if (location.pathname === '/feed' || location.pathname === '/' || location.pathname === '/auth') {
        CapApp.exitApp();
      } else {
        // Priority 3: Normal back navigation
        goBack();
      }
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, [location.pathname, goBack, isEmojiPickerOpen, setIsEmojiPickerOpen]);

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
