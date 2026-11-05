/**
 * Plans, features and limits, shared by web and mobile.
 *
 * The app is in beta: every feature is free. These rules are written now and already used by the screens, so going live
 * later means connecting a payment provider and switching the mode, not changing screens. While the mode is "beta" every
 * check below answers "yes, unlimited".
 *
 * The rules themselves live in the database (plans and plan_entitlements). This file only reads what the database
 * returns from my_entitlements() and answers questions about it.
 */

/** Every feature or limit a plan can include. Add new keys here and in the plan_entitlements table, nowhere else. */
export const ENTITLEMENT = {
  POSTS_CREATE: 'posts.create',
  DM_CREATORS: 'dm.creators',
  ROOMS_PRIVATE_MAX: 'rooms.private.max',
  PORTFOLIO_ITEMS_MAX: 'portfolio.items.max',
  PROJECTS_MAX: 'projects.max',
  JOBS_ACTIVE_MAX: 'jobs.active.max',
  TEAM_SEATS_MAX: 'team.seats.max',
  ANALYTICS_ADVANCED: 'analytics.advanced',
  VERIFIED_BADGE: 'verified.badge',
  COMPANY_PAGE_VERIFIED: 'company.page.verified',
  PROMOTIONS_BUY: 'promotions.buy',
} as const;

export type EntitlementKey = (typeof ENTITLEMENT)[keyof typeof ENTITLEMENT];

/** true or false for a feature, a number for a limit, null for "unlimited" */
export type EntitlementValue = boolean | number | null;

export interface EntitlementSnapshot {
  mode: 'beta' | 'live';
  /** while true, every feature is unlocked and every limit is lifted */
  all_unlocked: boolean;
  beta_ends_at?: string | null;
  plan?: string | null;
  status?: 'beta' | 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired' | null;
  period_end?: string | null;
  cancel_at_period_end?: boolean;
  entitlements: Record<string, EntitlementValue>;
}

/** Before the real answer arrives, behave exactly as the beta does so nothing flickers or locks. */
export const BETA_SNAPSHOT: EntitlementSnapshot = { mode: 'beta', all_unlocked: true, entitlements: {} };

/** May this person use this feature? A limit counts as available when it is above zero or unlimited. */
export function canUse(snapshot: EntitlementSnapshot | null | undefined, key: EntitlementKey | string): boolean {
  const s = snapshot ?? BETA_SNAPSHOT;
  if (s.all_unlocked) return true;
  const v = s.entitlements[key];
  if (v === undefined) return false;
  if (v === null) return true;
  if (typeof v === 'boolean') return v;
  return v > 0;
}

/** The most of something this person may have. `null` means no limit. */
export function limitOf(snapshot: EntitlementSnapshot | null | undefined, key: EntitlementKey | string): number | null {
  const s = snapshot ?? BETA_SNAPSHOT;
  if (s.all_unlocked) return null;
  const v = s.entitlements[key];
  if (v === undefined) return 0;
  if (v === null) return null;
  if (typeof v === 'boolean') return v ? null : 0;
  return v;
}

/** Room left under a limit, given how many the person already has. `null` means no limit. */
export function remainingUnder(snapshot: EntitlementSnapshot | null | undefined, key: EntitlementKey | string, used: number): number | null {
  const limit = limitOf(snapshot, key);
  return limit === null ? null : Math.max(0, limit - used);
}

/** Whole days until the beta ends, or null when no end is set or it has passed. */
export function betaDaysLeft(snapshot: EntitlementSnapshot | null | undefined, now: number = Date.now()): number | null {
  if (!snapshot || snapshot.mode !== 'beta' || !snapshot.beta_ends_at) return null;
  const end = new Date(snapshot.beta_ends_at).getTime();
  if (Number.isNaN(end) || end <= now) return null;
  return Math.ceil((end - now) / 86400000);
}

/** 29900 and "INR" become "₹299". Money is always kept as whole minor units (paise, cents) and only formatted here. */
export function formatMoney(minor: number, currency: string = 'INR', locale: string = 'en-IN'): string {
  const major = minor / 100;
  const whole = Number.isInteger(major);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(major);
}

/** Percentage of a price in basis points (1000 = 10%), rounded to a whole minor unit. Used for platform fees. */
export function feeFromBps(amountMinor: number, bps: number): number {
  return Math.round((amountMinor * bps) / 10000);
}

/** A person-friendly name for a limit or feature, for upgrade prompts. */
export const ENTITLEMENT_LABEL: Record<string, string> = {
  [ENTITLEMENT.POSTS_CREATE]: 'Publishing posts',
  [ENTITLEMENT.DM_CREATORS]: 'Messaging creators',
  [ENTITLEMENT.ROOMS_PRIVATE_MAX]: 'Private discussion rooms',
  [ENTITLEMENT.PORTFOLIO_ITEMS_MAX]: 'Portfolio items',
  [ENTITLEMENT.PROJECTS_MAX]: 'Projects',
  [ENTITLEMENT.JOBS_ACTIVE_MAX]: 'Active job postings',
  [ENTITLEMENT.TEAM_SEATS_MAX]: 'Team seats',
  [ENTITLEMENT.ANALYTICS_ADVANCED]: 'Advanced analytics',
  [ENTITLEMENT.VERIFIED_BADGE]: 'Verified badge',
  [ENTITLEMENT.COMPANY_PAGE_VERIFIED]: 'Verified company page',
  [ENTITLEMENT.PROMOTIONS_BUY]: 'Promotions',
};
