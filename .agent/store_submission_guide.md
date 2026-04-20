# CineCraft Connect: Store Submission Guide

This guide provides a checklist of everything you need to prepare for submitting CineCraft Connect to the Apple App Store and Google Play Store.

## 1. App Information & Metadata

Both stores require descriptive metadata to help users find and understand your app.

| Item | Requirement | Tip |
| :--- | :--- | :--- |
| **App Name** | Max 30 chars | Keep it consistent: "CineCraft Connect" |
| **Subtitle/Short Description** | Max 30-80 chars | "The ultimate creator ecosystem" |
| **Description** | Max 4,000 chars | Focus on keywords: Film, Production, Crew, Networking. |
| **Category** | Primary & Secondary | Entertainment, Social Networking, or Professional Services. |
| **Keywords** | 100 characters (Apple only) | Separate by commas. No spaces. |
| **Support URL** | Required | Link to your help desk or a contact form. |
| **Marketing URL** | Optional | Your website: `cinecraftconnect.com` |

## 2. Privacy & Legal (Implemented ✅)

The following pages are now available at the root of your domain:
- **Privacy Policy**: `https://yourdomain.com/privacy`
- **Terms of Service**: `https://yourdomain.com/terms`
- **Account Deletion**: Users can delete their account in **Settings > Account**.

> [!IMPORTANT]
> When filling out the "App Privacy" section in App Store Connect, you must declare that the app collects:
> - Contact Info (Email)
> - User Content (Portfolio, Posts)
> - Identifiers (User ID)
> - Usage Data

## 3. Visual Assets

| Asset Type | Specifications |
| :--- | :--- |
| **App Icon** | 1024x1024px (Must be unique, no transparency for Apple) |
| **Screenshots (iPhone)** | 6.7" (iPhone 14/15 Pro Max) and 6.5" (iPhone 11/12 Pro Max) |
| **Screenshots (iPad)** | 12.9" (optional but recommended) |
| **Screenshots (Android)** | At least 2-4 screenshots, 320px to 3840px |
| **Feature Graphic (Play Store)** | 1024x500px (Crucial for Android discovery) |

## 4. Technical Checklist

- [ ] **Bundle ID**: Ensure `com.cinecraftconnect.app` (or similar) is consistent across both stores.
- [ ] **Versioning**: Update `version` and `build` numbers in your `package.json` and native manifests for every release.
- [ ] **App Transparency Tracking (Apple)**: If you use analytics (like Google Analytics or PostHog) for tracking users across other apps, you must implement the ATT prompt.
- [ ] **App Review Account**: Create a "Test Account" for the reviewers to use. Provide the credentials in the "App Review Information" section.

## 5. Account Deletion Requirement

Apple and Google strictly enforce that apps allowing account creation must also allow account deletion.
- **Functionality**: Users can click "Delete Account" in settings. 
- **Effect**: We currently delete the user's `profile` record and sign them out. 
- **Recommendation**: In the future, you may want to set up a Supabase Edge Function to fully delete the user from `auth.users` for total compliance.

---

> [!TIP]
> **Beta Testing**: Use **TestFlight** (Apple) and **Internal Testing** (Google) before going live. This allows you to catch UI bugs that only appear on native mobile browsers.
