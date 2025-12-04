import { Link, useLocation } from 'react-router-dom';
import { Home, Play, Film, Briefcase, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';


const NavLinks = () => {
  const location = useLocation();
  const { user } = useAuth();

  // Function to check if a path is active
  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const allNavItems = [
    { path: '/feed', icon: Home, label: 'Home' },
    { path: '/', icon: Play, label: 'Landing' },
    { path: '/projects', icon: Film, label: 'Projects' },
    { path: '/discussion-rooms', icon: Play, label: 'Discussions' },
    { path: '/jobs', icon: Briefcase, label: 'Jobs' },
    { path: '/network', icon: Users, label: 'Network' }
  ];

  // Show different items based on authentication status
  const navItems = user
    ? allNavItems.filter(item => item.path !== '/') // Hide Landing for authenticated users
    : allNavItems.filter(item => item.path === '/'); // Show only Landing for unauthenticated users

  return (
    <nav className="flex items-center gap-1 w-full">
      <div className="flex items-center gap-1 min-w-max">
        {navItems.map(({ path, icon: Icon, label }) => (
          <Link
            key={path}
            to={path}
            className={`nav-item px-2 lg:px-2 xl:px-3 py-2 rounded-lg transition-all duration-200 hover-lift relative group whitespace-nowrap flex items-center gap-2 ${isActive(path) ? 'nav-item-active' : 'nav-item-inactive'
              }`}
          >
            <Icon size={18} className="flex-shrink-0" />
            <span className="font-medium text-sm">{label}</span>
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
