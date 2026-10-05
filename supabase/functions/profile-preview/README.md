# profile-preview

Link previews for shared profiles (WhatsApp, X, Slack, Google). Optional.

Deploy (public, no login needed):

    supabase functions deploy profile-preview --no-verify-jwt

Optional secret: `APP_ORIGIN` (defaults to https://cinecraftconnect.com).

Use the link `https://<project-ref>.supabase.co/functions/v1/profile-preview?u=<username>` when you want a rich preview.
Real visitors are redirected to `/profile/<username>` in the app. Private, banned or blocked profiles only get a generic card.
