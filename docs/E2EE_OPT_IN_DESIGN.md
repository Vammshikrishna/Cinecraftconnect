# Encrypted messages: opt-in design and reference

Status: phases 1–3 and the first-run offer built (2026-10-06). Phase 4 and the follow-ups at the end are not built.
Applies to: web (`apps/web`), mobile (`apps/mobile`), shared rules (`packages/core`), database (`supabase/manual/part_an_e2ee_opt_in.sql`).

Read this before changing anything under `lib/e2ee`, `E2EEBackupContext`, `useGroupKey`, `useGroupEncryption`,
`useE2EEChatKeys`, the mobile `services/e2eeState.ts`, or any code that sends a direct or group message.

---

## 1. What this document is for

CineCraft Connect already had end-to-end encryption (E2EE) for direct messages, private rooms and project spaces, but it
was **forced on for everybody** and the PIN dialog popped up on every page. This work makes it:

1. **opt-in** per person (a switch in Settings → Messages),
2. **contextual** (the PIN dialog only appears on message screens, like X/Twitter),
3. **honest** (every conversation says whether it is encrypted and why),
4. **safe by default** (encrypted chats never quietly fall back to plain text).

It also records how E2EE works here, what it does and does not protect, and what is still weak, so the next person does
not have to rediscover it.

---

## 2. Glossary

| Term | Meaning here |
|---|---|
| E2EE | Only the people in a conversation can read it. The server stores ciphertext it cannot open. |
| Public key | Published on `profiles.public_key`. Anyone can use it to lock a message *for* that person. |
| Private key | Never leaves the person's devices (browser secure store / Android Keystore). Unlocks messages. |
| Hybrid encryption | A random AES-256-GCM key encrypts the message; that key is then locked with RSA for each reader. |
| Group key | One AES-256-GCM key per room/space, locked separately for each member (`group_keys`). |
| PIN backup | The private key, encrypted with a key derived from a 6-digit PIN, stored in `key_backups`. Used to unlock a new device. |
| Opted in | `profiles.e2ee_enabled = true`. |
| Locked | Opted in, but this device does not hold the private key yet (new device). PIN required. |
| Unlocked | Opted in and this device holds the private key. |
| Plaintext chat | A normal chat the server can read (search, safety checks work). Not encrypted. |

---

## 3. How it works today (as built)

### 3.1 Cryptography (verified in `apps/web/src/lib/e2ee/core.ts`)

* **Identity key:** RSA-OAEP 2048, SHA-256.
* **Direct message:** fresh random 256-bit AES-GCM key per message → message encrypted with it → the AES key is locked
  with RSA **twice** (once for the sender so they can re-read it, once for the recipient). Payload is JSON:
  `{"__e2ee":true,"type":"dm","for_sender":…,"for_recipient":…,"ciphertext":…,"iv":…}`.
* **Group message:** one shared AES-256-GCM key per room/space; envelope `{"version":2,"type":"group",…}`.
  The key is locked for each member and stored in `group_keys (target_type, target_id, user_id, encrypted_symmetric_key)`.
* **PIN backup:** PBKDF2-SHA256, 100,000 iterations, 128-bit salt → AES-GCM key → encrypts the private key → `key_backups`.
* **Key storage:** web: `getSecureKeyStore()` from `@cinecraft/storage`; mobile: `NativeSecureKeyStore` (Android Keystore),
  mirrored to the native layer for notification decryption.

### 3.2 What the server can see

Ciphertext, who talks to whom, when, message sizes, and room/space membership. It cannot read encrypted message
content or attachments' encrypted payloads. Share cards (`POST_SHARE::id` etc.) are plain references (IDs), not content.

### 3.3 Where rooms stand

| Conversation | Encrypted? |
|---|---|
| Direct message | Only when **both** people have opted in |
| Public discussion room (`room_type = 'public'`) | Never: anyone can join, so there is nobody to share a key with |
| Private / secret discussion room | Yes, always |
| Project space | Yes, always |

---

## 4. Product decisions (and why)

These were chosen as sensible defaults. Change them deliberately, in this table, not ad hoc in code.

| # | Decision | Why |
|---|---|---|
| D1 | New accounts start **off**. People who already had a key are **grandfathered on** (migration). | Forcing a PIN on every new user is hostile; changing existing users' behaviour would break their chats. |
| D2 | Turning off **keeps** the keys and the PIN backup. | Old encrypted history stays readable and it can be turned on again. Deleting keys is a separate, deliberate "reset". |
| D3 | A DM is encrypted only if both sides are on. Otherwise it is a plaintext chat and **the UI says so**. | Encryption needs the recipient's key; silent downgrade is the real danger. |
| D4 | Anti-downgrade: if a thread already contains encrypted messages and the next one would be plain text, the sender must confirm. | A server that hides someone's key could otherwise strip encryption without anyone noticing. |
| D5 | Encrypted groups are **room-level**, not per-person: members must be opted in **and unlocked** to read/write. | A group key is shared; a message is readable by all members or by none. |
| D6 | Encrypted groups **fail closed**: they never send plain text, with a specific reason (off / locked / key missing). | A plain-text message in an "encrypted" room is a data leak. |
| D7 | No plain-text **quick reply from a notification** into encrypted rooms/spaces; DM quick replies follow the same policy. | The background handler cannot show a confirmation, so it refuses rather than guess. |
| D8 | The PIN dialog appears **only** on message screens (chat list, a chat, an encrypted room/space) or when a person presses a button. | Matches the X model; Feed/Jobs/etc. must never be interrupted. |
| D9 | Share cards and moderation reports are outside this feature. | They carry references, not message bodies. |

---

## 5. States and rules

### 5.1 Per person

```
            turn on (creates/restores key, publishes public key, sets e2ee_enabled)
   OFF  ───────────────────────────────────────────────►  ON
    ▲                                                       │
    │ turn off (keys + PIN backup are kept)                 ├─ Unlocked: this device has the private key
    └───────────────────────────────────────────────────────┤
                                                            └─ Locked: no key here → PIN to unlock (or reset)
```

* **Turn on** (`enableE2EE`): if there is no key and no backup, create a key pair and publish the public half; if a key
  exists but was never published, publish its public half; if a **backup exists but no key on this device, never create
  a new key**: ask for the PIN (an explicit "reset" is a separate, destructive action). Then call `set_e2ee_enabled(true)`
  and open the PIN dialog (create PIN, or unlock).
* **Turn off** (`disableE2EE`): `set_e2ee_enabled(false)`. Nothing is deleted.

### 5.2 Direct message decision (`decideDmEncryption`, `packages/core/src/e2ee-policy.ts`)

| I'm on | My device unlocked | They're on | They have a public key | Result | Reason |
|---|---|---|---|---|---|
| no | – | – | – | plaintext | `self_off` |
| yes | no | – | – | **blocked** (ask for PIN) | `self_locked` |
| yes | yes | no | – | plaintext | `partner_off` |
| yes | yes | yes | no | plaintext | `partner_not_ready` |
| yes | yes | yes | yes | **encrypt** | `both_ready` |

Plain text is allowed only with a visible banner. If the thread already has encrypted messages (`isEncryptedPayload`),
plain text additionally requires an explicit confirmation (`needsDowngradeConfirmation`).

A partner's key is **ignored unless they are opted in**, even if a stale key exists on their profile.

### 5.3 Groups (`groupEncryptionKind`, `canJoinEncryptedGroup`)

* Public room → no key, plain text, "Public room" (no banner).
* Private/secret room, project space → encrypted. A member who is off sees "Turn on encrypted messages to read and send
  messages here"; a member who is on but locked sees "Unlock". Sending throws a specific error instead of sending plain text.

### 5.4 What each conversation shows

Direct chat banner (copy lives in `dmBanner()` so web and mobile match):

* encrypted → quiet line "Messages are end-to-end encrypted. Only you and X can read them."
* not encrypted → "X hasn't turned on encrypted messages" / "Messages in this chat are not encrypted" (+ **Turn on** if I am off)
* locked → "Unlock your encrypted messages" (+ **Unlock**)

---

## 6. Data model (`supabase/manual/part_an_e2ee_opt_in.sql`)

* `profiles.e2ee_enabled boolean not null default false`, `profiles.e2ee_enabled_at timestamptz`.
* **Migration:** everyone with a non-empty `public_key` is set to `true` (they were encrypted by default).
* Trigger `guard_e2ee_flag`: the flag cannot be switched **on** while `public_key` is empty; stamps `e2ee_enabled_at`.
* RPC `set_e2ee_enabled(p_enabled boolean)`: updates **your own row only** (`auth.uid()`); `authenticated` only.
* Existing tables unchanged: `key_backups`, `group_keys`, `dm_keys`, `profiles.public_key`.
* The database does **not** know whether a message is encrypted (no check on `direct_messages.content`). The client decides.

Run order: after part AM, then deploy web + mobile. See `DEPLOY_CHECKLIST.md`.
Old app builds keep working: they still read `public_key` and encrypt as before (see §10 for the one caveat).

---

## 7. Where the code is

### Shared (`packages/core/src`)
* `e2ee-policy.ts`: `decideDmEncryption`, `needsDowngradeConfirmation`, `dmBanner`, `groupEncryptionKind`,
  `canJoinEncryptedGroup`, `isEncryptedPayload`. **Pure functions, no I/O.** Both apps use them; do not re-implement.
* Tests: `apps/web/src/tests/e2ee/policy.test.ts` (10 tests; run `npm run test --workspace=@cinecraft/web`).

### Web (`apps/web/src`)
| Concern | File |
|---|---|
| State machine, enable/disable, PIN setup/recover | `contexts/E2EEBackupContext.tsx` (`e2eeEnabled`, `hasLocalKey`, `promptRequested`, `requestPrompt`, `openPrompt`, `enableE2EE`, `disableE2EE`) |
| PIN dialog (shown only when `promptRequested`) | `components/security/E2EEKeyBackupModal.tsx` |
| Ask for the dialog from message screens | `hooks/useE2EEPrompt.ts` (used by `Messages`, `ChatsList`, `ChatPage`, `DiscussionChatInterface` for private rooms, `ProjectChatInterface`) |
| Turn on/off with explanations | `hooks/useE2EEActions.ts` |
| DM keys + policy | `hooks/useE2EEChatKeys.ts` (returns `dmPolicy`) |
| DM send / banner | `components/chat/EnhancedRealTimeChat.tsx`, `components/chat/E2EEChatBanner.tsx` |
| Forward | `components/chat/ForwardMessageDialog.tsx` (same policy per recipient) |
| Group send gate | `hooks/useGroupEncryption.ts` (`requireEncryption`) |
| Group banner | `components/chat/E2EEGroupBanner.tsx` |
| Settings | `components/settings/EncryptedMessagesSection.tsx` in `pages/settings/MessagesSettings.tsx` |
| Confirm dialogs | `lib/confirmDialog.ts` + `components/common/ConfirmHost.tsx` |

### Mobile (`apps/mobile/src`)
| Concern | File |
|---|---|
| State store, enable/disable, `useE2EEState`, `useHasLocalE2EEKey` | `services/e2eeState.ts` |
| Confirm + turn on/off | `services/e2eeActions.ts` |
| App bootstrap (reads the flag; no key creation/dialog unless opted in) | `App.tsx` |
| PIN dialog | `components/security/E2EERecoveryPinModal.tsx` (visible via `isE2EEPromptVisible`) |
| DM keys + policy | `hooks/useE2EEChatKeys.ts` (returns `dmPolicy`) |
| DM send + banner | `screens/messages/ConversationScreen.tsx`, `components/security/E2EEBanner.tsx` |
| Groups | `hooks/useGroupEncryption.ts` (`requireEncryption`), `DiscussionRoomDetailScreen`, `ProjectSpaceScreen` |
| Notification quick reply | `services/notificationActionHandler.ts` |
| Settings | `components/settings/EncryptedMessagesSettings.tsx` in `SettingsDetailScreen` |

Mobile cache keys: `e2ee_enabled_<userId>` (self), `e2ee_en_<userId>` (other people), `pub_key_<userId>`.

---

## 8. Security rules for future changes

1. **Fail closed.** If you cannot prove a message should be plain text, do not send it. An encrypted group or an
   encrypted thread must never fall back to plain text on an error.
2. **Never trust a stale key.** Use a partner's public key only if `e2ee_enabled` is true *now*.
3. **Never overwrite a key you did not create.** A backup without a local key means "unlock", not "generate".
4. **No silent downgrade.** Plain text in a previously encrypted thread needs a confirmation.
5. **Keys and PINs never go to logs, analytics, or error reports.** (Existing code logs key *status* only; keep it so.)
6. **One rule set.** Decisions live in `packages/core/src/e2ee-policy.ts`. If web and mobile disagree, fix core.
7. **Adding a new way to send a message?** Route it through the same policy and add a case to `policy.test.ts`.

---

## 9. Test plan

Automated: `npm run test --workspace=@cinecraft/web` (policy matrix, anti-downgrade, group rules, payload detection).

Manual matrix (do on web **and** a phone; two accounts A and B):

| # | Setup | Expect |
|---|---|---|
| 1 | A on, B on, both unlocked | Lock banner, messages unreadable in DB (`content` starts with `{"__e2ee"`) |
| 2 | A on, B off | A sees "B hasn't turned on…"; message stored as plain text; B sees it normally |
| 3 | A off, B on | A sees "not encrypted… Turn on"; plain text |
| 4 | Both off | Plain chat; banner says not encrypted |
| 5 | Encrypted thread, then B turns off, A sends | A gets the "Send without encryption?" confirmation; Cancel keeps the draft |
| 6 | A on, new device, no key | Banner "Unlock"; sending is blocked and opens the PIN dialog |
| 7 | New account | No PIN dialog anywhere; no key is created; opening Messages shows no dialog |
| 8 | Enable from Settings | Confirmation text, then create-PIN dialog; `profiles.e2ee_enabled` true |
| 9 | Disable, then re-enable | History still readable; no new key; no PIN needed if it was already unlocked |
| 10 | Private room, member off | Banner "Turn on…"; send shows "Turn on encrypted messages…", nothing is stored |
| 11 | Project space, member locked | Banner "Unlock"; send shows "Unlock encrypted messages…" |
| 12 | Public room | No banner; plain text works |
| 13 | Notification quick reply: DM (both on / partner off), private room, project space | DM follows policy; encrypted rooms/spaces: not sent |
| 14 | Forward a message to a chat with an opted-out person | Forwarded as plain text (no crash) |

---

## 10. Rollout and rollback

Order: run SQL part AN → deploy web → ship mobile.

* **Run the SQL before the new builds go live.** If a build runs before the column exists, it falls back to the old
  behaviour (everyone counts as opted in, via `fetchE2EEProfileInfo` in `lib/e2eeProfiles.ts` / `services/e2eeProfiles.ts`),
  so chats stay encrypted. The Settings switch and the turn-on buttons need the SQL (`set_e2ee_enabled`) and will report an error until it is run.
* **Old builds after the SQL:** keep encrypting using `public_key`. A person who later turns encryption **off** in a new
  build still has a `public_key`, so an old-build partner would still encrypt to them. That person's new build handles
  it (it keeps the key), so nothing is lost, but the banner on the old build will not say "not encrypted".
* **Rollback:** the app change is revertible on its own. To revert the data: `ALTER TABLE public.profiles DROP COLUMN
  e2ee_enabled, DROP COLUMN e2ee_enabled_at;` and drop `guard_e2ee_flag` / `set_e2ee_enabled`. No keys or messages are touched.

---

## 11. Known weaknesses (not fixed by this work)

1. **6-digit PIN is brute-forceable offline.** The backup blob sits on the server; 10^6 PINs × 100k PBKDF2 rounds is
   minutes on a GPU. The 5-attempt lockout is client-side only. Fix: server-enforced attempt limits (HSM/vault, as Signal
   and X do) or a longer secret. (A longer-passphrase option exists and was intentionally left as is.)
2. **The "Double Ratchet" (`dm/`) and "MLS" (`group/mls.ts`) modules are placeholders**, not real protocols: their seeds
   derive from non-secret IDs/timestamps. The live DM path uses the RSA hybrid scheme above and the live group path uses
   the shared AES key, so messages are not affected, but **do not describe or rely on it as Signal/MLS**.
3. **Public keys come from our server.** A compromised server could substitute a key. Needs safety-number verification
   (`identity/verification.ts` exists but is not surfaced).
4. **No forward secrecy.** A stolen private key decrypts all past messages sent to it.
5. **Group key rotation on member removal is unverified.** The envelope hard-codes `epoch: 1`. Confirm that removing a
   member issues a new key and re-wraps it for the remaining members.
6. **A group key is created/wrapped by existing members' clients.** A member who turns encryption on later is not
   readable until someone online re-wraps the key for them (`useGroupKey` self-healing). No server-side guarantee.
7. **Moderation:** the server cannot read encrypted chats. Reports contain the reporter's copy, which can be forged
   because messages are not signed.

---

## 12. Backlog (suggested order)

1. ~~First-run offer~~ **Built:** `E2EEOfferCard` (web `components/chat`, mobile `components/security`) sits above the chat list for
   people who are not opted in; "Not now" is remembered per user (`e2ee_offer_dismissed_<id>`).
2. **Server-side join rule (phase 3b):** a trigger on private-room/project-space membership that rejects members who
   are not opted in (or a pending state), plus invite copy "Turn on encrypted messages to join".
3. **Verify and fix group key rotation** on removal (item 5 above); decide whether newcomers see earlier history.
4. **Strict mode:** per-account "Only send encrypted messages" (block instead of plain text).
5. **Biometric unlock on mobile** and "lock after N days"; device list; change-PIN.
6. **PIN hardening:** server-enforced attempt limits, or require a stronger secret; raise PBKDF2 cost / move to Argon2.
7. **Safety numbers** (compare/scan keys) and key-change warnings.
8. **Signed messages** so reports can prove who wrote what.
9. **Forward secrecy:** replace the placeholder ratchet with a real implementation (or adopt an audited library).
10. **Notification quick reply for encrypted rooms/spaces** (encrypt in the background using the stored group key).

---

## 13. Why the PIN dialog may not appear

The dialog is only for two situations, and only on message screens: **create a recovery PIN** (opted in, no backup yet) and
**unlock this device** (opted in, backup exists, no key here). It does **not** appear when:

* you are opted **out** (use the offer card, the chat banner, or Settings → Messages),
* you are opted in and this device is already unlocked (nothing to ask),
* you pressed "dismiss" earlier in this session (use the banner **Unlock** button or Settings),
* the SQL part AN has not been run and the build is older than the fallback (see §10).

## 14. Quick answers

* *Why can't I message an opted-out person encrypted?* No key to lock the message with. It is sent as a normal message and the chat says so.
* *If I turn it off, do I lose old messages?* No. Keys and the PIN backup stay. Only "Reset" deletes the identity.
* *Why did the PIN dialog stop appearing on Feed?* By design (D8). It appears on message screens.
* *Does a public room ever get encrypted?* No (D5, §3.3).
* *Where do I change the wording?* `dmBanner()` in `packages/core/src/e2ee-policy.ts` and the confirm texts in
  `useE2EEActions.ts` (web) / `e2eeActions.ts` (mobile). Keep both in sync.
