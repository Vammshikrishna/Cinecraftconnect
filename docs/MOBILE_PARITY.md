# Mobile parity for this round

This page says which of the web changes in [FEATURES_THIS_ROUND.md](FEATURES_THIS_ROUND.md) were also built into the mobile app (`apps/mobile`). For the older, wider comparison see [PLATFORM_PARITY.md](PLATFORM_PARITY.md).

Important: the mobile changes were checked with the TypeScript compiler and unit tests. They have not been run on a phone. The iOS app has never been compiled (see `IOS_SETUP.md`).

## Brought to mobile this round

- Message requests: Requests inbox, accept, decline, ignore, and the 3-message cap for the sender.
- Mute and pin chats, synced with the web through the database.
- Edit your own message in direct chats, room chats and project chats (15 minutes).
- Share cards for a room, a pitch and a film.
- Missed-call rows in the chat.
- Reconnect grace: a short network drop does not end the call.
- Fan call gating: fans do not see call buttons, and the database also refuses.
- Private-room settings ("Who can find this room") and request to join.
- Team roles picker for a project.
- Project invite links.
- Schedule phases.
- Notifications: dismiss with Undo, and a Requests tab.
- @mention picker in chat.
- Report dialog changes (same reasons and rules as web).
- Edit profile: validation and custom links.
- Marketplace listing edit and price rules.
- Service package edit and delete.
- Payments: tax invoice and CSV export. They are shared as text (see "Still open").
- Offline job queue: jobs saved while offline are sent later.
- In-app round logo.

## Deliberately not on mobile

- All staff tools: moderation, admin, super admin and finance consoles, support desk, exports, saved views, digests, on-call rota, incident desk, compliance. Staff work on the web (tablet or desktop). Internal pages show "Tablet or Desktop Required" on a small screen.
- The `/status` page. TO CONFIRM whether you want a link to it in the app.
- The forced "Choose your own password" screen. It only applies to staff, and staff do not use mobile.

## Still open

- Forgot password and email verification are missing on both web and mobile.
- Native launcher icons (Android and iOS) were not re-checked after the logo change.
- Company-page announcement view timing: not decided. TO CONFIRM what the intended behaviour is.
- CSV files on mobile are shared as text, not saved as a real `.csv` file.
- SQL parts needed by mobile are the same as web. See [SQL_RUN_ORDER.md](SQL_RUN_ORDER.md).

## Needs a device test

Run these on a real Android phone (and later an iPhone):

1. Requests: receive a request, accept, decline, ignore. Check the badge. Check the sender cannot send a 4th message.
2. Mute and pin a chat on mobile, then check it on web.
3. Edit a direct message, a room message and a project message. Try after 15 minutes.
4. Share a room, a pitch and a film into a chat. Open each card.
5. Calls: a missed call row, a short network drop (switch Wi-Fi off and on), the busy message, a fan account without call buttons.
6. Picture-in-picture and the in-call notification (Android).
7. Private room: set "Who can find this room", ask to join from a second account.
8. Project: roles picker, invite link, schedule phases.
9. Notifications: dismiss then Undo, Requests tab.
10. Chat: type @ and pick a person.
11. Report a post, a message and a profile.
12. Edit profile with a bad link, then a good custom link.
13. Edit a marketplace listing and try a price below the rules. Edit and delete a service package.
14. Payments: open a tax invoice and share the CSV.
15. Turn on airplane mode, post a job, turn it off, check the job is sent.
16. Launcher icon and app logo on Android home screen, and on iOS when built.
17. Keyboard, small screens and dark mode on each new screen.
