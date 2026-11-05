// Pure decision for the onboarding gate. No React, no network: easy to test.
// Rule: until we KNOW the profile is onboarded (or staff), nothing of the app may render.
export type OnboardingGateProfile = {
  onboarding_completed?: boolean | null;
  is_banned?: boolean | null;
  is_internal?: boolean | null;
  role?: string | null;
} | null | undefined;

export type OnboardingGateDecision = 'signin' | 'wait' | 'retry' | 'onboarding' | 'app' | 'banned';

export function onboardingGateDecision(input: {
  hasSession: boolean;
  profile: OnboardingGateProfile;
  profileLoadFailed?: boolean;
}): OnboardingGateDecision {
  const { hasSession, profile, profileLoadFailed } = input;
  if (!hasSession) return 'signin';
  if (!profile) return profileLoadFailed ? 'retry' : 'wait';
  if (profile.is_banned) return 'banned';
  const isInternal = !!profile.is_internal || (!!profile.role && ['admin', 'moderator', 'super_admin'].includes(profile.role));
  if (isInternal) return 'app';
  return profile.onboarding_completed === true ? 'app' : 'onboarding';
}
