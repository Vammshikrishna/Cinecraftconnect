import type { ReactNode } from 'react';
import { BG, INK } from './tokens';

/* The public pages linked from the footer (About, Features, Documentation, Guidelines, Safety Center, Privacy, Terms, Cookies) look like
   the landing page, whatever theme the signed-in app uses: a warm light page, Work Sans headings, orange accents.
   Several of these pages are written with the app's theme colours (hsl(var(--background)) and friends), which follow the dark theme.
   Re-declaring those colours here, for this subtree only, makes every one of them light without touching their markup. */
const PublicPage = ({ children }: { children: ReactNode }) => (
  <div
    className="public-page light"
    style={{
      background: BG,
      color: INK,
      minHeight: '100dvh',
      // the app's theme colours, re-declared in the landing page's palette
      ['--background' as string]: '40 22% 98%',
      ['--foreground' as string]: '24 24% 7%',
      ['--card' as string]: '0 0% 100%',
      ['--card-foreground' as string]: '24 24% 7%',
      ['--popover' as string]: '0 0% 100%',
      ['--popover-foreground' as string]: '24 24% 7%',
      ['--muted' as string]: '30 14% 94%',
      ['--muted-foreground' as string]: '25 8% 34%',
      ['--secondary' as string]: '30 14% 94%',
      ['--secondary-foreground' as string]: '24 24% 7%',
      ['--accent' as string]: '10 100% 96%',
      ['--accent-foreground' as string]: '8 76% 38%',
      ['--border' as string]: '24 10% 88%',
      ['--input' as string]: '24 10% 88%',
      ['--primary' as string]: '8 76% 44%',
      ['--primary-foreground' as string]: '0 0% 100%',
      ['--ring' as string]: '8 100% 60%',
    }}
  >
    <style>{`
      /* headings: Work Sans, bold, tight, as on the landing page (some pages set a serif inline) */
      .public-page h1 { font-family: 'Work Sans', system-ui, sans-serif !important; font-weight: 700 !important; letter-spacing: -0.035em !important; line-height: 1.04 !important; text-transform: none !important; }
      .public-page h2 { font-family: 'Work Sans', system-ui, sans-serif !important; font-weight: 700 !important; letter-spacing: -0.02em !important; text-transform: none !important; }
      .public-page h3 { font-family: 'Work Sans', system-ui, sans-serif !important; font-weight: 700 !important; letter-spacing: -0.012em !important; text-transform: none !important; }
      .public-page main { scroll-behavior: smooth; }
      /* the small cards inside the reading pages were drawn with 4px corners; match the landing page's soft cards */
      .public-page [style*="border-radius: 4px"], .public-page [style*="border-radius:4px"] { border-radius: 14px !important; }
      .public-page [style*="border-radius: 6px"], .public-page [style*="border-radius:6px"] { border-radius: 12px !important; }
      .public-page a:focus-visible, .public-page button:focus-visible { outline: 2px solid #FF4B33; outline-offset: 3px; }
      /* long reading pages: comfortable measure and contrast */
      .public-page p { text-wrap: pretty; }
    `}</style>
    {children}
  </div>
);

export default PublicPage;
