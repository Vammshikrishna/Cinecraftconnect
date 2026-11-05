# Pitch and Story Exchange

Security and integrity rules for pitch calls, pitch submissions and the Story Exchange. The database enforces them
(`supabase/manual/part_av_pitch_security.sql`); web and mobile follow the same rules through `packages/core/src/pitch.ts`.

## What changed

| Area | Before | Now |
|---|---|---|
| Direct pitch | Any user could insert a pitch call with someone else as `creator_id`; if that failed the app pitched into *any* call | `submit_direct_pitch_call()` creates a private brief (not published). Blocked users refused, 5 direct pitches a day, no fallbacks |
| Pitch calls | Owner could change `creator_id`, `view_count`, direct-pitch fields | A guard trigger blocks those; 10 new calls a day |
| Submitting | Deadline and "closed" only checked in the app; status, NDA time could be sent by the client | Trigger checks: call open, deadline not passed, not your own call, not blocked, 20 a day, NDA signature when the call needs it. Status is always `submitted`, the NDA time is stamped by the server |
| Editing a submission | A writer could set their own status (e.g. `shortlisted`) | Writer edits the pitch text until the call owner has seen it (and may always add the full deck); the call owner can only change the review status |
| Story full synopsis | Readable by every signed-in user through the API | Column is not readable. `get_story_full_synopsis(story)` returns it to the writer, or to a producer the writer approved (with a signed NDA when the story needs one). Realtime publishes the same safe columns only |
| Story requests | A requester could insert `status: 'approved'` | Always starts `pending`; only the writer can change the decision; NDA signature text is stored with a server time |
| Views | Anyone could insert any view; nothing wrote them | `log_pitch_call_view()` counts one view per person per 12 hours, never the owner |
| Access logs / viewer NDA | Anyone could log or sign for any submission | Only the call owner or the writer of that submission |
| "Guild Verified" | Showed for any typed number | Shows **Guild (claimed)**: there is no verification yet |
| Deadlines | Never closed | `close_expired_pitch_calls()` runs when the list loads (throttled) |
| Notifications | Only status changes | The call owner is told about new pitches; story requests and decisions notify too |

## Client behaviour

- Story Exchange no longer falls back to `localStorage` or mock listings: errors are shown, not hidden.
- Incoming requests use an inner join, so only requests on your own stories come back.
- The review page marks a pitch *seen* only after the NDA gate, and only for the call owner.
- Status updates and saves show failures instead of pretending they worked.
- Search for pitch calls no longer errors on `genre` (a `text[]` column) and lists open calls only.

## Features added in part AW (part_aw_pitch_features.sql)

| Feature | Web | Mobile | How it works |
|---|---|---|---|
| Withdraw a pitch | Tracker | Tracker | `withdraw_pitch_submission()`; status `withdrawn`, the owner is told, the writer can pitch to the call again |
| Edit a sent pitch | Tracker -> Edit | Tracker -> Edit | Same form, prefilled. Allowed while the status is `submitted` or `seen` (the database enforces it) |
| Draft autosave | Submit form | Submit form | Kept on the device per person and call; restored with a "Start over" option; cleared when sent |
| Message to the writer | Review page | Review screen | `feedback` column (max 1000 characters); the writer sees it in the tracker and is notified |
| Private note + 1-5 rating | Review page | Review screen | Table `pitch_submission_notes`, readable only by the call owner |
| Close / re-open / duplicate a call | Call page | Call page | Closing notifies writers still waiting; re-opening moves a passed deadline a week ahead; a copy has no deadline, views or direct-pitch fields |
| Call numbers (views, saves, pitches) | Call page | Call page | `pitch_call_stats()`, owner only |
| Closing-soon reminder | notification | notification | Day before the deadline, to people who saved the call and have not pitched (sent when any client loads the list) |
| Spreadsheet export | Inbox | Inbox (share sheet) | CSV; cells starting with = + - @ are neutralised |

## Features added in part AX (part_ax_pitch_extras.sql)

| Feature | Web | Mobile | How it works |
|---|---|---|---|
| File attachments on a pitch | Submit form (step 3) | Submit screen (step 3) | Up to 3 PDFs or images, 15 MB each, in the private `pitch_assets` bucket under `attachments/<writer id>/`. Only the writer and the person pitched to can open them (signed links). The writer can change them while the pitch is still editable |
| Compare pitches | Inbox -> Select -> Compare | Inbox -> Select -> Compare | 2-3 pitches side by side with your private rating and note |
| Bulk actions | Inbox -> Select | Inbox -> Select | Under review / Shortlist / Pass for many pitches at once (writers are notified; withdrawn pitches are skipped) |
| Report | Pitch call page, review page | Pitch call screen, review screen | Goes to the normal moderation queue (`pitch_call`, `pitch_submission`). A takedown closes and unpublishes a call, or closes a pitch |
| Block | Review page | Review screen | Same blocklist as messages. A blocked person can no longer pitch to you or be pitched by you |
| NDA record | Review page, writer tracker (opens a printable page: save as PDF) | Review screen, tracker (share sheet, plain text) | `get_nda_record()`: who signed, as what, and when (server time), plus the terms shown to the writer. Only the writer and the call owner can fetch it. It is a record, not legal advice |

Fixes found while doing this: the NDA box on the mobile submit screen was hidden for direct pitches, so a writer could not sign; and the mobile review screen did not show the treatment, lookbook or deck links at all.

## Not done yet

Real guild verification (needs an external source to check against).
