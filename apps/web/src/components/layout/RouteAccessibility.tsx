import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

const BASE = 'CineCraft Connect';
const DEFAULT_TITLE = `${BASE} | The Professional Entertainment Ecosystem`;

/** First matching prefix wins, so more specific paths come first. */
const TITLES: [string, string][] = [
  ['/settings/help', 'Help Center'], ['/settings/legal', 'Policies'], ['/settings', 'Settings'],
  ['/feed', 'Home'], ['/create', 'Create post'], ['/posts', 'Post'], ['/post', 'Post'], ['/profile/availability', 'Availability'], ['/profile', 'Profile'],
  ['/messages', 'Messages'], ['/dm', 'Messages'], ['/chat', 'Chat'], ['/network/shortlists', 'Crew shortlists'], ['/network', 'Network'], ['/explore', 'Explore'], ['/search', 'Search'],
  ['/projects', 'Projects'], ['/project-space', 'Project space'], ['/discussion-rooms', 'Discussions'], ['/jobs', 'Jobs'],
  ['/marketplace', 'Marketplace'], ['/vendors', 'Vendors'], ['/pitch', 'Pitch'], ['/ratings', 'Ratings'], ['/my-ratings', 'My ratings'],
  ['/announcements', 'Announcements'], ['/pages', 'Pages'], ['/crafts', 'Crafts'], ['/craft', 'Craft'], ['/content', 'Details'],
  ['/lists', 'List'], ['/wishlist', 'Wishlist'], ['/support', 'Support Hub'], ['/auth', 'Sign in'], ['/register', 'Create account'],
  ['/complete-profile', 'Complete your profile'], ['/about', 'About'], ['/features', 'Features'], ['/privacy', 'Privacy Policy'], ['/terms', 'Terms of Service'], ['/cookie', 'Cookie Policy'],
  ['/category', 'Category'], ['/notifications', 'Notifications'], ['/community-guidelines', 'Community Guidelines'],
  ['/transparency', 'Transparency'], ['/status', 'System status'],['/safety-center', 'Safety Center'], ['/documentation', 'Documentation'],
  ['/all-crafts', 'Film Crafts'], ['/u', 'Profile'], ['/company', 'Company page'], ['/discussions', 'Discussions'],
  ['/gifts', 'Gifts'], ['/plans', 'Plans'], ['/payments', 'Payments'], ['/legal', 'Policies'],
  ['/moderation', 'Moderation'], ['/admin', 'Admin'], ['/finance', 'Finance'], ['/super-admin', 'Super admin'], ['/setup-admin', 'Admin setup'],
];
// Routes with no entry on purpose: '/' (landing page) and the '*' not-found page use the default title.

/** Tab title for a path, or the default title when no entry matches (exported for tests). */
export function getRouteTitle(pathname: string): string {
  const match = TITLES.find(([p]) => pathname === p || pathname.startsWith(p + '/'));
  return match ? `${match[1]} | ${BASE}` : DEFAULT_TITLE;
}
export const ROUTE_TITLE_TABLE = TITLES;

/**
 * Screen-reader and keyboard basics for a single-page app:
 *  - every route gets a meaningful tab title (pages that set their own via SEO keep it),
 *  - the new page is announced and keyboard focus moves to the content, like a normal page load,
 *  - a "Skip to content" link for keyboard users.
 */
export const RouteAccessibility = () => {
  const { pathname } = useLocation();
  const [announce, setAnnounce] = useState('');
  const first = useRef(true);

  useEffect(() => {
    const title = getRouteTitle(pathname);
    const before = document.title;
    // pages with their own SEO title set it after this render; only fill in when nothing more specific is there
    const t = window.setTimeout(() => {
      if (document.title === before || document.title === DEFAULT_TITLE) document.title = title;
      setAnnounce(document.title.split(' | ')[0]);
    }, 80);
    const idle = !document.activeElement || document.activeElement === document.body || document.activeElement.id === 'main-content';
    if (!first.current && idle) {
      document.getElementById('main-content')?.focus({ preventScroll: true });
    }
    first.current = false;
    return () => window.clearTimeout(t);
  }, [pathname]);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[10000] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div aria-live="polite" role="status" className="sr-only">{announce}</div>
    </>
  );
};
