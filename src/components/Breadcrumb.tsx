
import { ChevronRight, Home } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export const Breadcrumb = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  const getBreadcrumbName = (path: string) => {
    const nameMap: Record<string, string> = {
      'feed': 'Feed',
      'projects': 'Projects',
      'jobs': 'Jobs',
      'network': 'Network',
      'learn': 'Learning',
      'craft': 'Crafts',
      'discussion-rooms': 'Discussion Rooms',
      'chats': 'Messages',
      'profile': 'Profile',
      'settings': 'Settings',
      'explore': 'Explore'
    };
    return nameMap[path] || path.charAt(0).toUpperCase() + path.slice(1);
  };

  if (pathnames.length === 0 || location.pathname === '/') {
    return null;
  }

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-400 px-4 py-2 bg-cinesphere-dark/50 backdrop-blur-sm border-b border-white/10">
      <Link to="/" className="flex items-center hover:text-white transition-colors">
        <Home className="h-4 w-4" />
      </Link>
      
      {pathnames.map((name, index) => {
        const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        
        return (
          <div key={name} className="flex items-center space-x-2">
            <ChevronRight className="h-4 w-4" />
            {isLast ? (
              <span className="text-white font-medium">{getBreadcrumbName(name)}</span>
            ) : (
              <Link to={routeTo} className="hover:text-white transition-colors">
                {getBreadcrumbName(name)}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
};
