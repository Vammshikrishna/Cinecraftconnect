import pkg from '../../../package.json';
import { Film } from 'lucide-react';
import { SettingsLinkRow, SettingsPageHeader, SettingsSection } from '@/components/settings/SettingsUI';

const AboutSettings = () => (
  <>
    <SettingsPageHeader title="About" />

    <div className="rounded-2xl border bg-card p-6 flex items-center gap-4 mb-8">
      <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"><Film className="h-7 w-7" /></div>
      <div>
        <p className="text-lg font-bold leading-tight">CineCraft Connect</p>
        <p className="text-sm text-muted-foreground">Version {pkg.version} (web)</p>
        <p className="text-xs text-muted-foreground mt-1">Where filmmakers, crew and studios meet, build and work together.</p>
      </div>
    </div>

    <SettingsSection>
      <SettingsLinkRow title="About CineCraft Connect" href="/about" />
      <SettingsLinkRow title="Privacy Policy" to="/settings/legal/privacy" />
      <SettingsLinkRow title="Terms of Service" to="/settings/legal/terms" />
      <SettingsLinkRow title="Cookie Policy" to="/settings/legal/cookies" />
    </SettingsSection>
  </>
);

export default AboutSettings;
