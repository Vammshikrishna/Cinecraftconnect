# CineCraft Connect Web App - Logic & Flow Specification

This document details the logical architectures, data flows, cryptographic systems, and API structures implemented in the CineCraft Connect Web Application. Use this document as the reference technical blueprint to port and implement matching operations in your native mobile APK.

---

## 1. Authentication & Session Bootstrap Lifecycle

### A. Lifecycle Sequence
During the initial web app bootstrap inside `App.tsx`:
1.  **Auth Boot:** The `AuthProvider` initializes, checking local storage for a Supabase session.
2.  **Profile Fetch:** If an active session is detected, the provider queries the `profiles` table to load user profile attributes (including roles and whether onboarding is complete).
3.  **Governance Check:** The profile check determines if the user is banned (triggers `SuspendedGuard`), if onboarding is incomplete (redirects to `/complete-profile`), or if they are staff (bypasses maintenance mode).
4.  **E2EE Initialization:** The app checks the state of the E2EE key pairs via the `E2EEBackupProvider`.

### B. Route Guarding Hierarchy
Routing follows strict guards to prevent unauthorized access:
*   `ProtectedRoute`: Validates that `user` is authenticated.
*   `RoleGuard`: Restricts routes (e.g., `/admin`, `/moderation`) to specific roles (`admin`, `moderator`, `super_admin`).
*   `MaintenanceGuard`: Blocks access for non-staff users if the `maintenance_mode` platform flag is active.
*   `FeatureGuard`: Checks dynamic platform flags (e.g., `talent_network_enabled`, `messaging_enabled`) before mounting pages.

---

## 2. End-to-End Encryption (E2EE) Key Backup & Recovery System

The web app integrates secure client-side encryption for private chats using a PIN-based private key backup system.

```
[ Sign Up / Complete Profile ]
  ├── 1. Generate AES-GCM Key Pair (Client)
  ├── 2. Upload Public Key to 'profiles'
  ├── 3. Save Private Key to Local Cryptographic Storage
  └── 4. User Enters PIN -> Derive Salted key -> Encrypt Private Key -> Upload to 'key_backups'
```

### A. Initialization & Key Status Checks (`E2EEBackupContext`)
Upon startup, the system performs a status audit:
1.  **Local Check:** Searches browser storage for the user's private key (`CineCraft_E2EE_PrivateKey_${userId}`).
2.  **Remote Check:** Queries the `key_backups` table for remote encrypted payloads.
3.  **State Output:**
    *   *Case 1 (Local Key Present):* Validates the key. If valid, the user goes straight to the dashboard.
    *   *Case 2 (No Local Key, No Remote Backup):* Triggers **Setup Required** status. Instructs the user to create a backup PIN.
    *   *Case 3 (No Local Key, Remote Backup Found):* Triggers **Recovery Required** status. Prompts the user to enter their PIN to restore local chat capability.

### B. The Backup Process
When setting up a PIN:
1.  **Generation:** Client-side generation of a random 128-bit Salt.
2.  **Key Derivation:** Drives a key derivation function (PBKDF2) using the user's PIN + Salt to produce an encryption key.
3.  **Encryption:** Encrypts the raw Private Key with the derived key using AES-GCM.
4.  **Upload:** Inserts the resulting cipher-text and salt into the `key_backups` table in Supabase.

### C. The Recovery Process
When recovering on a new browser/device:
1.  **Download:** Fetches the encrypted private key and salt from the `key_backups` table.
2.  **Derivation:** Derives the recovery key using the user-provided PIN + downloaded Salt.
3.  **Decryption:** Decrypts the cipher-text using AES-GCM.
4.  **Verification:** Validates the private key. If successful, writes it to the local browser storage.

---

## 3. API & Data Synchronization (TanStack Query)

Web data operations are handled via TanStack Query (`@tanstack/react-query`) to manage API caching.

### A. Standard Caching Strategy
*   Data read hooks use query keys (e.g. `['connections_manual', userId]`, `['follows_manual', userId]`).
*   `staleTime` is set to 5 minutes to limit duplicate HTTP calls.
*   Mutations invalidate query keys on success to trigger fresh, background HTTP queries.

### B. Optimistic Updates
To keep the UI responsive, mutations on connections and comments optimistically write to the local cache before sending requests to Supabase, rolling back to previous state if the request fails.

---

## 4. Real-time Subscription Channel Mapping

The web app keeps pages synchronized with the database using Supabase Realtime WebSocket channels.

| Feature Name | Channel Name | Target Database Table | Callback Event / State Side-Effect |
| :--- | :--- | :--- | :--- |
| **Platform Flags** | `global-platform-governance` | `platform_flags` | Invokes `fetchFlags()` to toggle app-wide feature switches in real-time. |
| **User Follows** | `user_follows_${userId}` | `user_follows` | Invalidates `['follows_manual']` cache to trigger UI updates. |
| **User Connections** | `user_connections_follower_${userId}` & `user_connections_following_${userId}` | `user_connections` | Invalidates `['connections_manual']` and `['users']` caches. |
| **Unread Submissions** | `pitch_submissions_unread_${userId}` | `pitch_submissions` | Fires local count state refreshes across all hook observers. |

---

## 5. LiveKit Audio & Video Call Flow

Real-time audio and video communications are coordinated via LiveKit WebRTC.

### A. Context Handlers (`CallContext`)
1.  **Call Trigger:** Tapping "Call" issues an HTTP POST to a Supabase Edge Function to create a WebRTC token.
2.  **Room Setup:** Connects the local browser client to the LiveKit Server Room using the room token.
3.  **Media Permissions:** Prompts the browser for Camera/Mic media devices.
4.  **Signal Delivery:** Delivers push signaling alerts to target users via database updates and notifications.

### B. Media Stream Management
*   Subscribes to remote audio/video tracks and feeds them into HTML Video element render logs.
*   Supports toggle controls to mute local camera/mic streams.

---

## 6. Offline & System Status Fallbacks

*   **Offline Tracking:** A window listener tracks `online` / `offline` network events. On disconnection, it displays the `OfflineBanner` and restricts mutable forms.
*   **Error Boundary:** A top-level React Error Boundary intercepts rendering crashes, logs the trace to console, and presents a customized crash recovery screen.
