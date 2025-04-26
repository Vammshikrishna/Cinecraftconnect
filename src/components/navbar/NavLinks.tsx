
import { Link, useLocation } from 'react-router-dom';
import { Home, Play, Film, Briefcase, Users, BookOpen } from 'lucide-react';

const NavLinks = () => {
  const location = useLocation();
  
  // Function to check if a path is active
  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="hidden md:flex items-center space-x-6">
      <Link to="/" className={`nav-item ${isActive('/') ? 'nav-item-active' : 'nav-item-inactive'}`}>
        <Home size={18} />
        <span>Home</span>
      </Link>
      <Link to="/feed" className={`nav-item ${isActive('/feed') ? 'nav-item-active' : 'nav-item-inactive'}`}>
        <Play size={18} />
        <span>Feed</span>
      </Link>
      <Link to="/projects" className={`nav-item ${isActive('/projects') ? 'nav-item-active' : 'nav-item-inactive'}`}>
        <Film size={18} />
        <span>Projects</span>
      </Link>
      <Link to="/jobs" className={`nav-item ${isActive('/jobs') ? 'nav-item-active' : 'nav-item-inactive'}`}>
        <Briefcase size={18} />
        <span>Jobs</span>
      </Link>
      <Link to="/network" className={`nav-item ${isActive('/network') ? 'nav-item-active' : 'nav-item-inactive'}`}>
        <Users size={18} />
        <span>Network</span>
      </Link>
      <Link to="/learn" className={`nav-item ${isActive('/learn') ? 'nav-item-active' : 'nav-item-inactive'}`}>
        <BookOpen size={18} />
        <span>Learn</span>
      </Link>
    </nav>
  );
};

export default NavLinks;
