import { Link, useLocation } from 'react-router-dom';
import { Home, Film, Briefcase, Users, Star, Megaphone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountType } from '@/hooks/useAccountType';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import DiscussionRoomIcon from '@/components/icons/DiscussionRoomIcon';
import StudioPageIcon from '@/components/icons/StudioPageIcon';

import { useQueryClient } from '@tanstack/react-query';

const NavLinks = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { isFan } = useAccountType();
  const { hasUnreadDiscussions, hasUnreadProjects } = useUnreadMessages();
  const queryClient = useQueryClient();

  // Function to check if a path is active
  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const creatorNavItems = [
    { path: '/feed', icon: Home, label: 'Home' },
    { path: '/projects', icon: Film, label: 'ProjectSpace' },
    { path: '/discussion-rooms', icon: DiscussionRoomIcon, label: 'Discussions' },
    { path: '/jobs', icon: Briefcase, label: 'Jobs' },
    { path: '/network', icon: Users, label: 'Network' }
  ];

  const fanNavItems = [
    { path: '/feed', icon: Home, label: 'Home' },
    { path: '/discussion-rooms', icon: DiscussionRoomIcon, label: 'Discussions' },
    { path: '/ratings', icon: Star, label: 'Ratings' },
    { path: '/announcements', icon: Megaphone, label: 'Announcements' },
    { path: '/pages', icon: StudioPageIcon, label: 'Pages' }
  ];

  const navItems = (() => {
    if (!user) return [{ path: '/', icon: DiscussionRoomIcon, label: 'Landing' }];
    return isFan ? fanNavItems : creatorNavItems;
  })();

  const hasNotification = (label: string) => {
    if (label === 'Discussions') return hasUnreadDiscussions;
    if (label === 'ProjectSpace') return hasUnreadProjects;
    return false;
  };

  // Prefetch data on hover for instant feel
  const handlePrefetch = (path: string) => {
    if (path === '/feed') {
      // Prefetching feed static data
      queryClient.prefetchQuery({
        queryKey: ['home-feed-static', user?.id],
        staleTime: 1000 * 60 * 5,
      });
    } else if (path === '/projects') {
      queryClient.prefetchQuery({
        queryKey: ['projects', user?.id],
        staleTime: 1000 * 60 * 5,
      });
    }
    // Add other prefetch logic as needed
  };

  return (
    <nav className="flex items-center gap-1 w-full">
      <div className="flex items-center gap-1 min-w-max">
        {navItems.map(({ path, icon: Icon, label }) => (
          <Link
            key={path}
            to={path}
            onMouseEnter={() => handlePrefetch(path)}
            className={`nav-item px-2 lg:px-2 xl:px-3 py-2 rounded-lg transition-all duration-200 hover-lift relative group whitespace-nowrap flex items-center gap-2 ${isActive(path) ? 'nav-item-active' : 'nav-item-inactive'
              }`}
          >
            <div className="relative">
              <Icon size={21} className="flex-shrink-0" />
              {hasNotification(label) && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-red-500 border-2 border-background animate-pulse" />
              )}
            </div>
            <span className="font-serif font-bold uppercase tracking-tight text-[12px] lg:text-[13px]">{label}</span>
            {isActive(path) && (
              <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-6 h-0.5 bg-gradient-to-r from-primary to-primary/80 rounded-full"></div>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
};

export default NavLinks;
