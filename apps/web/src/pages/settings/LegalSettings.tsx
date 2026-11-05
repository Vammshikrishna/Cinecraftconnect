import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import PrivacyPolicy from '@/pages/legal/PrivacyPolicy';
import TermsOfService from '@/pages/legal/TermsOfService';
import CookiePolicy from '@/pages/legal/CookiePolicy';

/** A policy shown inside Settings: same tab, same menu, no marketing navbar or footer. */
const LegalSettings = () => {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  // Go back to wherever the person came from (About, Help or the hub); fall back to About on a direct load.
  const canGoBack = typeof window !== 'undefined' && (window.history.state?.idx ?? 0) > 0;
  // The public route is /cookie but the settings rows link to /settings/legal/cookies: accept both spellings.
  const kind = type === 'cookie' ? 'cookies' : type;
  return (
    <>
      {canGoBack ? (
        <button type="button" onClick={() => navigate(-1)} className="inline-flex min-h-11 items-center gap-1 -ml-2 px-2 text-sm text-muted-foreground hover:text-foreground active:opacity-60">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Back
        </button>
      ) : (
        <Link to="/settings/about" className="inline-flex min-h-11 items-center gap-1 -ml-2 px-2 text-sm text-muted-foreground hover:text-foreground active:opacity-60">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> About
        </Link>
      )}
      {kind === 'privacy' ? <PrivacyPolicy embedded /> : kind === 'terms' ? <TermsOfService embedded /> : kind === 'cookies' ? <CookiePolicy embedded /> : <p className="text-muted-foreground">That document does not exist. <Link to="/settings/about" className="text-primary underline-offset-4 hover:underline">Back to About</Link></p>}
    </>
  );
};

export default LegalSettings;
