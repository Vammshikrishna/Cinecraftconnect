import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/** The staff consoles have their own header and navigation, so they get no side column and no pull-up under it. */
export const isStaffConsolePath = (path: string) =>
  path === '/admin' || path.startsWith('/admin/') || path === '/moderation' || path.startsWith('/moderation/') ||
  path === '/super-admin' || path.startsWith('/super-admin/');

/** Paths where the bottom tab bar is hidden (open chats, project spaces), so no space needs reserving. */
const hidesBottomNav = (path: string) =>
  (path.startsWith('/messages/') && path !== '/messages') ||
  path.startsWith('/dm/') ||
  (path.startsWith('/chat/') && path !== '/chat') ||
  (path.startsWith('/discussion-rooms/') && path !== '/discussion-rooms') ||
  path.endsWith('/space') ||
  path === '/auth' || path === '/register' || path === '/create';

/**
 * Reserves room for the fixed bottom tab bar below the lg breakpoint, so the last card or button on every page
 * is never hidden behind it. One place instead of a pb-24 on each page.
 */
export const MobileNavInset = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const { user, profile } = useAuth();
  const reserve = !!user && !hidesBottomNav(pathname);
  // the side column is there for signed-in people on wide screens, the same cases in which the full navigation shows
  const hasSideNav = !!user && !isStaffConsolePath(pathname) && pathname !== '/auth' && pathname !== '/register' && (profile === null || !!profile?.onboarding_completed || !!profile?.is_internal || ['admin', 'moderator', 'super_admin'].includes((profile as any)?.role));
  return (
    <div id="main-content" tabIndex={-1} className={`outline-none ${reserve ? 'pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-0' : ''} ${hasSideNav ? 'lg:pl-[72px] lg:-mt-14' : ''}`}>
      {children}
    </div>
  );
};
