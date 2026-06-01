/**
 * CookieConsentBanner.tsx
 *
 * GDPR-compliant cookie consent banner.
 *
 * Behaviour:
 *  - Slides up on first visit (no existing localStorage entry)
 *  - Three consent tiers: Necessary (always on) · Analytics · Marketing
 *  - "Accept All" / "Reject Optional" / "Customise" actions
 *  - Persists choice to localStorage as:
 *      { necessary: true, analytics: bool, marketing: bool, version: 1, timestamp: ISO }
 *  - Dispatches a `consentUpdate` CustomEvent after choice (for analytics integrations)
 *  - Re-opens when `openCookieSettings()` is called (import and call from footer)
 *
 * Usage:
 *   <CookieConsentBanner />          — mount once at app root
 *   openCookieSettings()             — re-open from any "Manage Cookies" link
 */

import { useState, useEffect, useCallback } from 'react';
import { Cookie, ChevronDown, ChevronUp, Shield, BarChart2, Megaphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Storage key & shape ───────────────────────────────────────────────────────

const STORAGE_KEY = 'cc_consent';
const CONSENT_VERSION = 1;

export interface ConsentPreferences {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  version: number;
  timestamp: string;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function loadConsent(): ConsentPreferences | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentPreferences;
    // Re-prompt if schema version changed
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveConsent(prefs: Omit<ConsentPreferences, 'necessary' | 'version' | 'timestamp'>): ConsentPreferences {
  const full: ConsentPreferences = {
    necessary: true,
    analytics: prefs.analytics,
    marketing: prefs.marketing,
    version: CONSENT_VERSION,
    timestamp: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(full));
  // Notify any listening analytics integrations
  window.dispatchEvent(new CustomEvent('consentUpdate', { detail: full }));
  return full;
}

/** Call this from a "Manage Cookies" link anywhere in the app */
export function openCookieSettings() {
  window.dispatchEvent(new Event('openCookieConsent'));
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Slide-in state
  useEffect(() => {
    const existing = loadConsent();
    if (!existing) {
      // Small delay so it doesn't fight with other mount animations
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  // Allow external re-open (e.g., footer "Manage Cookies" link)
  useEffect(() => {
    const handler = () => {
      const existing = loadConsent();
      if (existing) {
        setAnalytics(existing.analytics);
        setMarketing(existing.marketing);
      }
      setVisible(true);
    };
    window.addEventListener('openCookieConsent', handler);
    return () => window.removeEventListener('openCookieConsent', handler);
  }, []);

  // Trigger mount animation
  useEffect(() => {
    if (visible) {
      requestAnimationFrame(() => setMounted(true));
    } else {
      setMounted(false);
    }
  }, [visible]);

  const dismiss = useCallback((prefs: { analytics: boolean; marketing: boolean }) => {
    saveConsent(prefs);
    setMounted(false);
    // Wait for slide-out animation then hide
    setTimeout(() => setVisible(false), 400);
  }, []);

  const acceptAll = () => dismiss({ analytics: true, marketing: true });
  const rejectOptional = () => dismiss({ analytics: false, marketing: false });
  const saveCustom = () => dismiss({ analytics, marketing });

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie consent"
      className={[
        'fixed bottom-0 left-0 right-0 z-[9999] transition-transform duration-400 ease-out',
        mounted ? 'translate-y-0' : 'translate-y-full',
      ].join(' ')}
    >
      {/* Backdrop blur strip */}
      <div className="bg-card/95 backdrop-blur-xl border-t border-border shadow-[0_-8px_40px_rgba(0,0,0,0.25)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">

          {/* ── Top row ── */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="p-2 rounded-xl bg-primary/10 shrink-0 mt-0.5">
                <Cookie className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">
                  We use cookies to improve your experience
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  We use cookies to keep you signed in, understand how you use CineCraft Connect,
                  and (optionally) personalise content.{' '}
                  <a href="/cookie" className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors font-medium">
                    Cookie Policy
                  </a>
                </p>
              </div>
            </div>

            {/* ── Action buttons ── */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(e => !e)}
                className="text-xs text-muted-foreground hover:text-foreground gap-1 h-8 px-3 rounded-lg"
              >
                Customise
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={rejectOptional}
                className="text-xs h-8 px-4 rounded-lg border-border hover:bg-muted"
              >
                Reject Optional
              </Button>
              <Button
                size="sm"
                onClick={acceptAll}
                className="text-xs h-8 px-5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all"
              >
                Accept All
              </Button>
              <button
                onClick={rejectOptional}
                aria-label="Dismiss banner (reject optional cookies)"
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ml-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ── Expandable customise panel ── */}
          <div
            className={[
              'overflow-hidden transition-all duration-300 ease-in-out',
              expanded ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0',
            ].join(' ')}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-4 border-t border-border pt-4">
              {/* Necessary — always on */}
              <ConsentCategory
                icon={<Shield className="h-4 w-4 text-green-500" />}
                title="Necessary"
                description="Session management, authentication, security. Cannot be disabled."
                enabled={true}
                locked
                onChange={() => {}}
              />

              {/* Analytics */}
              <ConsentCategory
                icon={<BarChart2 className="h-4 w-4 text-blue-500" />}
                title="Analytics"
                description="Help us understand how you use the platform so we can improve it."
                enabled={analytics}
                onChange={setAnalytics}
              />

              {/* Marketing */}
              <ConsentCategory
                icon={<Megaphone className="h-4 w-4 text-purple-500" />}
                title="Marketing"
                description="Personalised recommendations and promotional content."
                enabled={marketing}
                onChange={setMarketing}
              />
            </div>

            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={saveCustom}
                className="text-xs h-8 px-5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
              >
                Save My Preferences
              </Button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Sub-component: consent category toggle ────────────────────────────────────

interface ConsentCategoryProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  locked?: boolean;
  onChange: (val: boolean) => void;
}

function ConsentCategory({ icon, title, description, enabled, locked, onChange }: ConsentCategoryProps) {
  return (
    <div className={[
      'flex flex-col gap-2 p-3 rounded-xl border transition-all duration-200',
      enabled ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border/50',
    ].join(' ')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-bold text-foreground">{title}</span>
          {locked && (
            <span className="text-[9px] font-black uppercase tracking-widest text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded-full">
              Always On
            </span>
          )}
        </div>
        {/* Toggle */}
        <button
          role="switch"
          aria-checked={enabled}
          aria-label={`Toggle ${title} cookies`}
          disabled={locked}
          onClick={() => !locked && onChange(!enabled)}
          className={[
            'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            enabled ? 'bg-primary' : 'bg-muted',
            locked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
          ].join(' ')}
        >
          <span
            className={[
              'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5',
              enabled ? 'translate-x-4' : 'translate-x-0.5',
            ].join(' ')}
          />
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

export default CookieConsentBanner;
