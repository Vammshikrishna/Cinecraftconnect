import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Menu, X, WifiOff } from 'lucide-react';
import AppLogo from '@/components/common/AppLogo';
import { useScroll } from 'framer-motion';

const LandingNavbar = () => {
  const INK = '#111111';
  const SOFT = '#555555';
  const RULE = '#E5E5E3';
  // the home page's hero uses the full screen width, so its navbar does too; the other public pages keep their narrower column
  const wide = useLocation().pathname === '/';
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => scrollY.on('change', v => setScrolled(v > 50)), [scrollY]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const navLinks = [
    { name: 'Features', href: '/features' },
    { name: 'About', href: '/about' },
  ];

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        transition: 'all 0.3s ease',
        background: scrolled ? 'rgba(255,255,255,0.88)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? `1px solid ${RULE}` : '1px solid transparent',
      }}
    >
      {!isOnline && (
        <div style={{ background: '#FF4B33', color: '#fff', fontSize: 13, fontFamily: "'Work Sans', sans-serif", fontWeight: 500, padding: '8px 16px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <WifiOff size={12} />
          You are offline. Sign-in is paused.
        </div>
      )}

      <div style={{ maxWidth: wide ? 1760 : 1440, margin: '0 auto', padding: wide ? '16px clamp(24px, 4vw, 80px)' : '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppLogo size="sm" textColor="ink" />

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              style={{
                fontFamily: "'Work Sans', sans-serif",
                fontSize: 15,
                fontWeight: 500,
                color: SOFT,
                textDecoration: 'none',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = INK)}
              onMouseLeave={e => (e.currentTarget.style.color = SOFT)}
            >
              {link.name}
            </Link>
          ))}
        </div>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-5">
          <Link
            to="/auth"
            style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 15, fontWeight: 500, color: INK, textDecoration: 'none' }}
          >
            Sign in
          </Link>
          <Link to="/register">
            <button
              style={{
                background: '#111111',
                color: '#FFFFFF',
                fontFamily: "'Work Sans', sans-serif",
                fontSize: 14,
                fontWeight: 600,
                border: 'none',
                padding: '10px 18px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'background 0.2s',
                borderRadius: 10,
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#C4301B')}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = '#111111')}
            >
              Join now <ArrowRight size={14} />
            </button>
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden"
          onClick={() => setIsOpen(!isOpen)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: INK, padding: 4 }}
        >
          {isOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div style={{ background: '#FFFFFF', borderTop: `1px solid ${RULE}`, padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              onClick={() => setIsOpen(false)}
              style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 16, fontWeight: 500, color: SOFT, textDecoration: 'none' }}
            >
              {link.name}
            </Link>
          ))}
          <div style={{ height: 1, background: RULE }} />
          <Link to="/auth" onClick={() => setIsOpen(false)} style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 16, fontWeight: 500, color: SOFT, textDecoration: 'none' }}>
            Sign in
          </Link>
          <Link to="/register" onClick={() => setIsOpen(false)}>
            <button style={{ width: '100%', background: '#111111', color: '#FFFFFF', fontFamily: "'Work Sans', sans-serif", fontSize: 15, fontWeight: 600, border: 'none', padding: '14px 22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 4 }}>
              Join now <ArrowRight size={15} />
            </button>
          </Link>
        </div>
      )}
    </nav>
  );
};

export default LandingNavbar;
