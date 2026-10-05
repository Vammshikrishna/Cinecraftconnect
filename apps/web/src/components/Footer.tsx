import { Instagram, Twitter, Youtube, Facebook, ArrowUpRight, Clapperboard, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import AppLogo from '@/components/common/AppLogo';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer style={{ background: '#0D0D0D', color: '#F8F5F0' }}>
      {/* Top accent rule */}
      <div style={{ height: 3, background: 'linear-gradient(90deg, #f97316, #0D0D0D)' }} />

      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '72px 48px 40px' }}>

        {/* Brand row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 40, paddingBottom: 56, borderBottom: '1px solid rgba(248,245,240,0.08)', marginBottom: 56 }}>
          <div style={{ maxWidth: 340 }}>
            <AppLogo size="md" className="mb-6" textColor="cream" />
            <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 14, color: 'rgba(248,245,240,0.5)', lineHeight: 1.7, marginTop: 20 }}>
              The professional ecosystem for the film and creator community — built for directors, cinematographers, and digital storytellers worldwide.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              {[Instagram, Twitter, Youtube, Facebook].map((Icon, i) => (
                <a key={i} href="#" style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid rgba(248,245,240,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(248,245,240,0.4)', textDecoration: 'none', transition: 'all 0.2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#f97316'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(249,115,22,0.4)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(248,245,240,0.4)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(248,245,240,0.1)'; }}
                >
                  <Icon size={15} />
                </a>
              ))}
            </div>
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
                <h3 style={{ fontFamily: "'Inconsolata', monospace", fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#f97316', marginBottom: 20 }}>
                  {col.label}
                </h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {col.links.map((link) => (
                    <li key={link.name}>
                      <Link
                        to={link.to}
                        style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 13, color: 'rgba(248,245,240,0.45)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, transition: 'color 0.2s' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#F8F5F0')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(248,245,240,0.45)')}
                      >
                        {link.name}
                        <ArrowUpRight size={11} style={{ opacity: 0 }} />
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
          <p style={{ fontFamily: "'Inconsolata', monospace", fontSize: 11, color: 'rgba(248,245,240,0.2)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            © {currentYear} CineCraft Connect. All rights reserved.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Inconsolata', monospace", fontSize: 11, color: 'rgba(248,245,240,0.2)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            <Clapperboard size={12} style={{ color: '#f97316' }} />
            Version 2.4.0
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;