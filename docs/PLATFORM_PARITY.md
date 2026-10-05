# Web vs Mobile feature parity

Method: file/route inventory and keyword searches over `apps/web/src` and `apps/mobile/src`, plus the code I read
during the audit. Nothing here was run side by side, so treat "partial" rows as "verify on a device".

Legend: ✅ both · 🌐 web only · 📱 mobile only · ◐ both, but one side is noticeably thinner · — neither

## Social & content
| Feature | Status | Notes |
|---|---|---|
| Feed, post detail, create post | ✅ | |
| Likes, comments, bookmarks, share | ✅ | Share sheet code is separate per app |
| Hashtags, @mentions, tagged users | ✅ | |
| Pin post, hide likes, disable comments | ✅ | |
| Post polls / reposts / scheduled posts | — | Not implemented anywhere |
| Report a post / comment / message / job / listing / room / user | ✅ | Mobile now reports all of these (messages use `flagged_messages` with reporter consent) |
| Block a user | ✅ | Web: block button on profiles + Blocked Users list in Privacy settings; enforced in the database for DMs |

## Messaging & calls
| Feature | Status | Notes |
|---|---|---|
| Direct messages, reactions, reply, forward, star | ✅ | |
| Typing indicator | ◐ | Richer on web |
| Read receipts | ◐ | Web shows Delivered/Seen; mobile has a read-receipts setting |
| Edit sent message | — | |
| Voice notes | ✅ | |
| Audio/video calls (LiveKit) | ✅ | Mobile uses the real LiveKit engine and joins the same room as web (see `services/liveCall.ts`) |
| Screen sharing in calls | ✅ | Android uses MediaProjection; iOS needs a ReplayKit broadcast extension (not built) |
| Picture-in-picture during calls | 📱 | Android system PiP |
| Inline reply from a push notification | 📱 | |
| Attachments end-to-end encrypted | — | Not on either (stated in the app wording) |

## Projects
| Feature | Status | Notes |
|---|---|---|
| Create project, project space chat | ✅ | Two separate encryption implementations |
| Tasks, call sheets, shot list, budget, legal docs | ✅ | Web components are more detailed |
| Screenplay reader | ✅ | |
| Join requests / applicants management | ◐ | Fuller UI on web |
| Team management, project settings | ◐ | Fuller on web |
| Project apply (browse → apply) | ✅ | Mobile apply was a fake alert until this audit |

## Jobs, pitch, marketplace, vendors, pages
| Feature | Status | Notes |
|---|---|---|
| Jobs, apply, bookmarks, manage postings, my applications | ✅ | |
| Pitch calls, submit pitch, review submissions, story exchange, NDA | ✅ | |
| Pitch access logging (who opened a deck) | ✅ | Both write `pitch_access_logs` (action values fixed to match the DB constraint) |
| Marketplace listings, bundles, bookings, reviews | ✅ | |
| Wishlist | ✅ | Mobile can create/share the wishlist link; viewing a shared wishlist opens the web page |
| Vendors, services, register | ✅ | |
| Company pages: create, edit, follow, members | ✅ | |
| Announcements (create/browse) | ◐ | Fuller on web |

## Profile, account, safety
| Feature | Status | Notes |
|---|---|---|
| Edit profile, public profile, portfolio, skills | ✅ | |
| Availability calendar | ✅ | Both export a real .ics snapshot (the old fake iCal link/import was removed on both) |
| Multi-account switching | ✅ | |
| Verification request | ✅ | |
| Profile visibility / who-can-message privacy settings | ✅ | Enforced server-side now |
| Active sessions / "log out other devices" | ◐ | Web has a device list; mobile has a "Log out of other devices" button (same server function) |
| Appearance, accessibility, sound settings pages | 🌐 | Mobile has theme/font/haptics in two settings screens |
| Biometric app lock, do-not-disturb | 📱 | |
| Data export (JSON) | ✅ | Both call `export_my_data()` |
| Delete account | ✅ | Both call the `delete-account` function |
| Support tickets | ◐ | Both create and list tickets; screenshot attachments and ticket detail page are web only |

## Staff & platform
| Feature | Status | Notes |
|---|---|---|
| Admin dashboard, moderation, report triage, two-person approval | 🌐 | |
| Verification review, support ticket manager, feature flags | 🌐 | |

## Discovery & misc
| Feature | Status | Notes |
|---|---|---|
| Search (people, posts, projects, vendors, listings, companies) | ✅ | Advanced filters are web only |
| Ratings / TMDB browsing, platform cinema | ✅ | |
| Notifications list + push | ✅ | Native FCM on mobile, web push via service |
| Deep links | 📱 | |
| Offline cache | ◐ | Much heavier on mobile |
| Legal & help pages (privacy, terms, cookies, docs, safety center, guidelines) | ◐ | Hosted on the web; mobile Settings now links to Privacy, Terms, Safety Center and Guidelines |

## Intentionally different (not parity gaps)
Mobile-only native features: biometric app lock, do-not-disturb, system picture-in-picture for calls, inline reply from a push
notification, deep links.

## Still different (needs design/native work, not done)
- **Staff tools** (admin dashboard, report triage, two-person approval, verification review, feature flags) exist only on the web.
- **Screen sharing in calls (iOS only)** is missing: it needs a ReplayKit broadcast upload extension built in Xcode. Android and web work.
- **Richer management UIs** (project applicants/team, announcements, room moderation, advanced search filters, typing indicators) are fuller on web.
- **Read-receipts setting** is a stored preference on both sides; neither fully hides read state from the sender.
- **Two separate E2EE implementations** (web `lib/e2ee`, mobile `@cinecraft/e2ee`): test web↔mobile message round-trips.
