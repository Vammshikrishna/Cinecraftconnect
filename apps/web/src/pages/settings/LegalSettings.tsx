import { useParams } from 'react-router-dom';
import PrivacyPolicy from '@/pages/legal/PrivacyPolicy';
import TermsOfService from '@/pages/legal/TermsOfService';
import CookiePolicy from '@/pages/legal/CookiePolicy';
import { HelpBack } from '@/components/help/HelpParts';

/** A policy shown inside Settings: same tab, same menu, no marketing navbar or footer. */
const LegalSettings = () => {
  const { type } = useParams<{ type: string }>();
  return (
    <>
      <HelpBack to="/settings/help" label="Help" />
      {type === 'privacy' ? <PrivacyPolicy embedded /> : type === 'terms' ? <TermsOfService embedded /> : type === 'cookies' ? <CookiePolicy embedded /> : <p className="text-muted-foreground">That document does not exist.</p>}
    </>
  );
};

export default LegalSettings;
