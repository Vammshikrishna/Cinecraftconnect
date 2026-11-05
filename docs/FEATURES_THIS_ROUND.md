# What was built this round

A plain list of what is new or changed. For each one: who can use it, where it is in the app, and which SQL part it needs. The web app keeps working before the SQL is applied (the new feature shows a short note or is simply missing). See [SQL_RUN_ORDER.md](SQL_RUN_ORDER.md) for how to run the parts.

Mobile status of each item is in [MOBILE_PARITY.md](MOBILE_PARITY.md). Test results are in [testing/INDEX.md](testing/INDEX.md).

## Chat

| Feature | Who | Where | SQL part |
|---|---|---|---|
| Edit your own direct message. 15 minutes, text only. Shows "(edited)" to both people | Any signed-in user, not staff | Message menu in a direct chat | part_ge_dm_edit |
| Mute and pin chats. At most 3 pinned. Remembered on each device only if the SQL is missing | Any signed-in user | Chat list and chat menu | part_ge_chat_prefs |
| Message requests inbox. A person you are not connected to writes first: it lands in Requests. Accept, decline or ignore. Decline and ignore are silent. The sender can send 3 messages until you accept | Any signed-in user | Messages > Requests, plus a badge on the Messages nav | part_gf_message_requests |
| "Connections only" wording. The old "not accepting messages" refusal now says clearly the person only accepts messages from connections | Any signed-in user | When sending a message | None (text only) |
| Missed-call rows in the chat. A missed or declined call leaves a row in the thread | Any signed-in user | Inside the chat | None |
| Reconnect grace. A short drop in the network does not end a call at once | Anyone in a call | Call screen | None |
| Busy check. Calling someone who is on another call tells you "X is on another call" instead of ringing | Creators and studios | When starting a direct call | part_ge_call_busy |
| Fan call rule. Fan accounts cannot start calls. They can still be rung and join calls others started | Fan accounts (limited) | Call buttons are hidden for fans; the database also refuses | part_gg_fan_call_rule |
| Links in chat text are clickable (http and https only) | Everyone | All chats | None |

## Rooms and projects

| Feature | Who | Where | SQL part |
|---|---|---|---|
| Private-room "Who can find this room": Hidden or Listed. A listed private room shows its card and people can ask to join | Room owner sets it; anyone can request | Room settings; Discover | part_fs_private_room_discoverability |
| "Share this room" in room settings (a share card with a link) | Room members | Room settings | None |
| Team roles for a project, with a role-change history and a notice to the person | Project owner and admins | Project > Team | part_ft_project_member_roles (and part_ee_space_member_roles for spaces) |
| Edit your own message in rooms and project chats (15 minutes) | Members | Message menu | part_fq_edit_room_message |
| Project invite links that work, and owner and applicant notices | Project owner, applicants | Project > Invite | part_fh_projects_invite_links, part_fh_projects_owner_notification, part_fh_projects_applicant_notification |

## Staff tools

Staff accounts do not take part in the social side. All of these are on the web only.

### Finance role

- Who: the finance role (reads and decides refunds only), plus admin and super admin.
- Where: `/finance` console. Refund desk with tabs Needs action, All, Sent, Refused.
- Rule: a refund needs two approvals and the person who asked cannot approve their own. Finance cannot send a refund alone. Granting or removing the finance role needs two different super admins.
- SQL: part_gc_finance_role.

### Staff security

- Two-step sign-in (TOTP) for staff. Ships OFF. Turning it on needs a second super admin and every staff member must have enrolled first.
- Forced password change: a newly created staff account, or one a super admin resets, must choose its own password before any page opens. It applies to staff only.
- `/setup-admin` (first super admin page) is hidden once a super admin exists.
- Who: super admins control it. All staff are affected.
- Where: Super admin > Staff security; the "Choose your own password" screen.
- SQL: part_gd_staff_security.

### Moderator tools

- Who: moderators, admins, super admins. Where: `/moderation`.
- **Claim lock:** a case claimed by one moderator can only be closed by that moderator (admins can step in). Idle claims free themselves.
- **Escalation reason:** needed to escalate. Shown on the case and in the history.
- **SLA badges:** Overdue, soon, ok on each case, plus sidebar counters.
- **Bulk actions:** dismiss several cases with a reason. Cases held by someone else are skipped and counted.
- **Saved replies and macros.**
- **Mark as duplicate:** close a case as a duplicate of another open case. Both are linked.
- **Handover notes:** short shift notes with linked cases, read-by marker, edit and delete within 15 minutes.
- **Queue CSV export:** the cases you are looking at, no personal data, one audit entry.
- **Keyboard shortcuts** in the console.
- **Repeat-offender banner** (strikes in the last 90 days).
- SQL: part_ga_mod_tools, part_gh_mod_duplicates, part_gh_mod_handover, part_gh_mod_queue_export. Saved replies and shortcuts: TO CONFIRM whether they need SQL.

### Admin tools

- Who: admins and super admins. Where: `/admin`.
- **Support desk:** give a ticket to a staff member, ready-made replies, SLA chip, internal notes the user never sees, team workload table (Free, Light, Busy). SQL: part_gb_admin_support_desk.
- **Account overview** on a user record: orders and payments, devices and sessions, reports, warnings. No email, token or password. SQL: part_gb_admin_account_overview.
- **Exports:** CSV of people summary, support tickets and verification queue, with a date range. No email, phone or message text. Each export is logged. SQL: part_gb_admin_exports.
- **Saved views:** save a filter on an admin table and open it again. SQL: part_gb_admin_saved_views.
- **Report take-down approval executor:** when a second admin approves a take-down, shadowban or ban, it is really carried out. Older approved ones are caught up. SQL: part_gb_admin_report_approval_executor.

## Owner team

- Who: super admins mostly; some pieces are open to admins or all staff, as noted.
- **Team dashboards** (support, trust and safety, finance, growth): counts only, no personal data. Seen on Super admin Overview, Admin Operations, Moderation (Team numbers tab) and Finance. SQL: part_gi_1_team_dashboards.
- **Compliance export and erasure tracker:** a super admin asks for a person's data bundle, a different super admin approves, then it downloads. Erasure requests are logged with a 30-day clock. Nothing is deleted automatically. SQL: part_gi_2_compliance_pack.
- **On-call rota:** a primary and a backup for each day. Admins set it. All staff see "On call now" in the header. SQL: part_gi_3_oncall_rota.
- **Public `/status` page and incident desk:** anyone can read the status without signing in. Admins open and update incidents with public wording. Internal notes are never shown. SQL: part_gi_4_status_page.
- **Staff digest emails and schedule:** daily or weekly numbers email. Each staff member opts in for themselves. A super admin can switch someone off. Needs the `staff-digest` function, secrets and extensions. SQL: part_gi_5_staff_digest, part_gi_6_schedule, part_gi_7_digest_recipients_fix. See [DEPLOY.md](DEPLOY.md).

## Billing

- **Paying vs free users card:** how many people pay, are on a trial, were gifted a plan, are on the free beta, or are free. Counts only. Who: admin and super admin. Where: Admin > Operations and Super admin > Overview. SQL: part_fz_user_plan_stats.
- **Invoices and credit notes:** numbered tax invoices (one per paid order) and credit notes (one per refund), a finance report, tax settings. The tax rate starts at 0 (off). Payments are still off. Who: super admin sets details; buyers read their own. Where: Billing tab > Finance; Payments. SQL: part_fy_finance_invoices.

## UX fixes

- **Announcement card layout** fixed.
- **Accessible names** added to buttons (call controls, and others found unnamed in testing).
- **Suspended page** now shows the reason.
- **Vendor rejection reason** is shown to the vendor.
- **Logo** is a round PNG.
- **Your reports** page (Settings > Help > Your reports) lists the reports you sent. SQL: part_fq_my_reports.
- **Wishlist share** sends a readable message with a link instead of raw text.

SQL needed for these: none, except as noted. TO CONFIRM the full list of UX fixes against your own change notes; this page lists what the test results mention.
