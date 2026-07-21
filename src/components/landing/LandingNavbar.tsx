import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X, WifiOff } from 'lucide-react';
import AppLogo from '@/components/common/AppLogo';
import { useScroll } from 'framer-motion';

const LandingNavbar = () => {
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
        background: scrolled ? 'rgba(248,245,240,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(13,13,13,0.08)' : '1px solid transparent',
      }}
    >
      {!isOnline && (
        <div style={{ background: '#f97316', color: '#fff', fontSize: 11, fontFamily: "'Inconsolata', monospace", letterSpacing: '0.15em', textTransform: 'uppercase', padding: '8px 16px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <WifiOff size={12} />
          Offline — login paused
        </div>
      )}

      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppLogo size="sm" textColor="ink" />

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              style={{
                fontFamily: "'Work Sans', sans-serif",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'rgba(13,13,13,0.6)',
                textDecoration: 'none',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#0D0D0D')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(13,13,13,0.6)')}
            >
              {link.name}
            </Link>
          ))}
        </div>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-5">
          <Link
            to="/auth"
            style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(13,13,13,0.55)', textDecoration: 'none' }}
          >
            [ Sign In ]
          </Link>
          <Link to="/register">
            <button
              style={{
                background: '#0D0D0D',
                color: '#F8F5F0',
                fontFamily: "'Work Sans', sans-serif",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                border: 'none',
                padding: '11px 22px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'background 0.2s',
                borderRadius: 4,
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#f97316')}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = '#0D0D0D')}
            >
              Join Now <ArrowRight size={13} />
            </button>
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden"
          onClick={() => setIsOpen(!isOpen)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0D0D0D', padding: 4 }}
        >
          {isOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div style={{ background: '#F8F5F0', borderTop: '1px solid rgba(13,13,13,0.08)', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              onClick={() => setIsOpen(false)}
              style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(13,13,13,0.7)', textDecoration: 'none' }}
            >
              {link.name}
            </Link>
          ))}
          <div style={{ height: 1, background: 'rgba(13,13,13,0.08)' }} />
          <Link to="/auth" onClick={() => setIsOpen(false)} style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(13,13,13,0.6)', textDecoration: 'none' }}>
            [ Sign In ]
          </Link>
          <Link to="/register" onClick={() => setIsOpen(false)}>
            <button style={{ width: '100%', background: '#0D0D0D', color: '#F8F5F0', fontFamily: "'Work Sans', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', border: 'none', padding: '14px 22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 4 }}>
              Join Community <ArrowRight size={15} />
            </button>
          </Link>
        </div>
      )}
    </nav>
  );
};

export default LandingNavbar;
