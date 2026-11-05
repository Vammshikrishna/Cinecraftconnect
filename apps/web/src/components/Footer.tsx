import { Clapperboard } from 'lucide-react';
import { Link } from 'react-router-dom';
import AppLogo from '@/components/common/AppLogo';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer style={{ background: '#0D0D0D', color: '#F8F5F0' }}>
      {/* Top accent rule */}
      <div style={{ height: 3, background: 'linear-gradient(90deg, #FF4B33, #0D0D0D)' }} />

      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '72px 48px 40px' }}>

        {/* Brand row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 40, paddingBottom: 56, borderBottom: '1px solid rgba(248,245,240,0.08)', marginBottom: 56 }}>
          <div style={{ maxWidth: 340 }}>
            <AppLogo size="md" className="mb-6" textColor="cream" />
            <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 14, color: 'rgba(248,245,240,0.5)', lineHeight: 1.7, marginTop: 20 }}>
              The professional ecosystem for the film and creator community — built for directors, cinematographers, and digital storytellers worldwide.
            </p>
          </div>

          {/* Link columns */}
          <div style={{ display: 'flex', gap: 64, flexWrap: 'wrap' }}>
            {[
              {
                label: 'Platform',
                links: [
                  { name: 'About', to: '/about' },
                  { name: 'Features', to: '/features' },
                  { name: 'Marketplace', to: '/features#marketplace' },
                  { name: 'Documentation', to: '/documentation' },
                ]
              },
              {
                label: 'Community',
                links: [
                  { name: 'Network', to: '/features#network' },
                  { name: 'Job Board', to: '/features#jobs' },
                  { name: 'Projects', to: '/features#projects' },
                  { name: 'Support Hub', to: '/support' },
                ]
              },
              {
                label: 'Legal',
                links: [
                  { name: 'Terms', to: '/terms' },
                  { name: 'Privacy', to: '/privacy' },
                  { name: 'Cookies', to: '/cookie' },
                  { name: 'Guidelines', to: '/community-guidelines' },
                  { name: 'Safety Center', to: '/safety-center' },
                ]
              },
            ].map((col) => (
              <div key={col.label}>
                <h3 style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 14, fontWeight: 600, color: '#FFFFFF', marginBottom: 16 }}>
                  {col.label}
                </h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {col.links.map((link) => (
                    <li key={link.name}>
                      <Link
                        to={link.to}
                        style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.7)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, minHeight: 40, transition: 'color 0.2s' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
            © {currentYear} CineCraft Connect. All rights reserved.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Work Sans', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
            <Clapperboard size={12} style={{ color: '#FF4B33' }} />
            Version 2.4.0
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;