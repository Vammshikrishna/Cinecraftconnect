# Deployment checklist

Already applied: Part A, Part D, Part F.

Safe to run now (any time): Part H, J, K, L, and Part O (part_o_call_membership.sql – fixes "not an authorized member" on calls for project creators / linked rooms), Part M (part_m_answer_call_live_calls.sql – lets people join a running group call after the first 45 seconds).

**Part P (part_p_jobs_hiring.sql)** – jobs & hiring upgrade (pipeline stages, applicant notifications, interviews, job alerts, job analytics, private resumes bucket, tighter application security). Run it BEFORE using the new web/mobile builds; the new job screens read its columns and tables. Order: part_m, part_n, part_o, then part_p.

**Part Q (part_q_marketplace_security.sql)** – marketplace & vendors security (server-side booking requests, booking status rules, verified-only reviews, protected moderation/verification columns, bundle ownership, private wishlist tokens, abuse limits). Run after part P, then deploy the new web + mobile builds (they call request_booking and get_my_wishlist_token).

**Part R (part_r_marketplace_bookings_quotes.sql)** – booking workflow (notifications, availability, linked bundle rows), vendor quotes, vendor verification (creates the private `vendor_docs` bucket), gear alerts, seller hub numbers. Run after part Q, then deploy the new web + mobile builds.

**Part S (part_s_service_alerts.sql)** – alerts for vendor services (adds `kind` to gear_alerts). Run after part R, then deploy the new web + mobile builds.

**Part T (part_t_company_pages_fixes.sql)** – company pages security + bug fixes (verified/follower columns locked, post-as-page check, working follower counter with a one-time recount, page admins can edit, team members no longer manage). Run after part Q, then deploy the new web + mobile builds.

**Part U (part_u_company_page_team.sql)** – company page team invitations (accept / decline / leave), admin roles, follower list, notifications to followers when a page posts or opens a job. Run after part T, then deploy the new web + mobile builds. Note: team members can no longer be added directly; the old "add member" path is closed.

**Part V (part_v_company_page_growth.sql)** – company page verification request (creates the private `page_docs` bucket), page insights, showcase (gallery + showreel links), ownership transfer. Run after part U, then deploy the new web + mobile builds.

**Part W (part_w_company_page_privacy.sql)** – company page privacy: follower list visible only to the person and page managers; contact email/phone moved to a private table readable by signed-in users only. Run after part V, then deploy the new web build (the edit dialog and page read the new table).

**Part X (part_x_announcements.sql)** – announcements: security fixes (author and page enforced, manager-only page rights, limits, staff removal, reportable), categories, pinning, audience, expiry, scheduling, reactions, comments, views, unread, server-side list/paging, follower notifications. Run after part W (needs part T), then deploy the new web + mobile builds. Existing announcements keep working and are not re-notified.

**Part Y (part_y_announcements_more.sql)** – announcements: edit history, pin/edit flags per item, company-page announcements list, platform broadcasts in the main list. Run after part X, then deploy the new web + mobile builds.

**Part Z (part_z_announcements_remove_reactions.sql)** – removes announcement reactions and comments (tables, trigger, list fields). Run once after part Y if parts X/Y were already run with them, then deploy the new web + mobile builds. (Parts X and Y no longer create them, so a fresh setup does not need part Z.)

**Part AA (part_aa_ratings_security.sql)** – ratings & reviews security: working helpful counts, no self-rating / self-helpful, anonymous reviews really anonymous, other people's ratings private, atomic rating+review save, limits, platform-title protections, reports for reviews and titles, fixed pro/fan segments. Run after part Z, then deploy the new web + mobile builds (they read reviews through list_film_reviews and save through submit_film_feedback).

**Part AB (part_ab_ratings_features.sql)** – ratings features: ratings remember title/poster (My Ratings), watchlist, review filters + paging, creator notification for new reviews. Run after part AA, then deploy the new web + mobile builds (the rating buttons now save through submit_film_feedback with the title details, so run this SQL first).

**Part AC (part_ac_ratings_new.sql)** – ratings new features: weighted score, creator replies to reviews (reply_to_review), trending titles, lists (private/public, share link). Run after part AB, then deploy the new web + mobile builds.

**Part AD (part_ad_network_security.sql)** – network security + bug fixes: requests only as pending, only the receiver accepts, no self/duplicate/reverse pairs, blocks respected, private connection graph (counts + lists via functions), one notification per request + accepted notification, server-side People you may know with real mutuals, paging and remembered dismissals. Run after part AC, then deploy the new web + mobile builds (they call suggest_people, list_user_connections and get_connection_counts).

**Part AE (part_ae_network_features.sql)** – network features: who can send me connection requests, a note with a request, ignore a request quietly, network_overview (connections / requests / ignored with mutual counts). Run after part AD, then deploy the new web + mobile builds.

**Part AF (part_af_network_new.sql)** – network new features: private notes + tags on connections, crew availability (open to work) with a Discover filter, introductions through a mutual connection, collaborators from shared project spaces, network insights, smarter suggestions (shared projects / company pages). Run after part AE, then deploy the new web + mobile builds.

**Part AG (part_ag_profile_security.sql)** – profile security + bugs: credits need the person's acceptance, profile views through a function, case-insensitive usernames + reserved names, safe profile lookup, skills/experience/portfolio follow profile visibility. Run after part AF, then deploy the new web + mobile builds. **Then, last (after the builds are live): part_ag_lock_moderation_columns.sql** – members can no longer read restriction_flags / shadow-ban / force-password-reset columns.

**Part AH (part_ah_profile_features.sql)** – profile features: completeness score, highlights (showreel, languages, gear, public CV, hidden sections), awards / festivals / press, availability now follows the calendar. Run after part AG, then deploy the new web + mobile builds.

**Part AI (part_ai_profile_new.sql)** – profile new features: skill endorsements (connections only), Discover filters by skill / gear / language / city, a profile hint from real numbers. Run after part AH, then deploy the new web + mobile builds. (The crew sheet page needs no SQL.)

**Part AJ (part_aj_public_profile.sql)** – public profile fixes: real follower/following counts (no 1,000 cap), profile access state (private / unavailable / blocked), one-call relationship status, links must be http(s) or a plain domain. Run after part AI, then deploy the new web + mobile builds.

**Part AK (part_ak_public_profile_features.sql)** – public profile features: how you are connected (mutuals, shared projects / company pages), recent activity strip + active-this-week hint, Message button for people you are not connected to when they allow it, tab links. Run after part AJ, then deploy the new web + mobile builds.

**Part AL (part_al_profile_collaboration.sql)** – working together: date requests (accept / decline / counter, accepted dates become Tentative in the calendar), personal project invitations, recommendations (the person approves), private crew shortlists. Run after part AK, then deploy the new web + mobile builds. Optional: deploy the profile-preview edge function for rich link previews (see supabase/functions/profile-preview/README.md).

**Part AM (part_am_help_center.sql)** – Help Center: support tickets now show replies to the user (notification + thread), guided request form with screenshots/diagnostics, close / reopen, satisfaction rating, article feedback; hardens ticket and message tampering (limits, forced status, no spoofed senders). Run after part AL, then deploy the new web + mobile builds.

## 1. Deploy edge functions
supabase functions deploy delete-account revoke-other-sessions push-reply push-delivery process-background-jobs transcode-video livekit-token space-control
(audio spaces also need the secret LIVEKIT_URL, e.g. https://<project>.livekit.cloud, plus SQL part_m then part_n)

## 2. Deploy new web + mobile builds
(they read profile_extras / profile_private, use signed URLs for pitch decks and support screenshots,
open the presence channel as private, and call the new functions)

## 3. After the builds are live, run in this order
1. part_e_private_presence.sql   – then check online dots still appear for signed-in users
2. part_c_private_buckets.sql    – then open a pitch full-deck and a support screenshot
3. part_b_move_private_profile_columns.sql – drops profiles.phone/push_token/encrypted_private_key
4. part_g_drop_moved_profile_columns.sql   – LAST; drops old public social/rate columns

## 4. Smoke tests
- Edit profile (web + mobile), view own and another user's profile with visibility public/connections/private
- Send a DM to a user set to "nobody" (should be refused); block a user
- Delete-account on a throwaway account
- Project-space call, DM notification, pitch notification
