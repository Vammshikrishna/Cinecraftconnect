# Admin console: what is missing, and how payments should work when we add them

Status: analysis and plan. Section 2A (the gaps) is now built (SQL part_bu and the screens listed in its checklist entry); everything else is still plan.
Written from the code and SQL in this repository (web, mobile, `supabase/manual`), not from the live database.

---

## 1. What the console has today

| Area | What exists |
| --- | --- |
| Moderator console (`/moderation`) | "My day" panel, case queue, case detail, review mode, reported chat messages queue, case assist, on-duty switch, precedents for similar reports |
| Admin console (`/admin`) | Operations stats, verification queues (people, vendors, pages), user records with a full timeline and strikes, support tickets, appeals, report triage board, audit ledger, templates, VIP invites, governance tuning |
| Super admin console (`/super-admin`) | Approvals (maker-checker), governance settings, staff role matrix, security, risk distribution, growth, global broadcast, platform flags and policies |
| Rules in the database | Strikes (3 in 180 days mutes for 7 days), appeals with a second admin for reversals, auto-hide of reported content, report bundles, ban lifecycle, maker-checker queue, staff alerts, audit ledger, audited access to private spaces |

This is a strong base. The gaps below are mostly **missing screens and missing proactive tools**, not missing foundations.

---

## 2. What is missing, in priority order

### A. Broken or incomplete today (fix first)

1. **Audited-access requests have no approval screen.**
   `approve_space_access()` exists in the database, but no screen calls it. A standard request therefore waits for ever; only the emergency override works.
   Build: an "Access requests" queue in the admin console (reason, requester, target, time waiting, approve or reject with a note), a notification to eligible approvers when a request is created (the `access_` type is already allowed for staff), and an expiry job. Rank rules are already in the function (a moderator's request needs an admin, a super admin's needs another super admin).
2. **Tables with no screen:** `legal_requests`, `fraud_networks`, `user_risk_profiles` (device hashes, VPN and proxy flags), `platform_rules`. They are written or planned but nobody can see or act on them.
3. **Staff security basics:** nothing enforces two-factor sign-in for staff, session limits for staff, or a periodic review of who holds which role.

### B. Moderation features worth adding

| # | Feature | Why | Builds on |
| --- | --- | --- | --- |
| 1 | **Automated detection rules**: keyword and pattern rules, link and phishing checks, duplicate or copy-paste spam, new-account throttles, image scanning for nudity and violence | Today everything starts from a human report, so harm is seen late | `_apply_rules`, `_auto_hide_target`, the report queue (auto-created reports with low priority and a reason) |
| 2 | **Ban-evasion and fraud network view**: same device, same IP ranges, linked accounts, with one-click actions on the whole group | Device hashes are collected but never used | `user_risk_profiles`, `fraud_networks`, `gov_entity_relationships` |
| 3 | **Service levels and workload**: time-to-first-action targets, breach alerts, auto-assignment to on-duty moderators, per-moderator workload and skills | Reports can sit unseen | `moderator_claim_report`, `set_on_duty`, `notify_staff` |
| 4 | **Quality review**: a second moderator re-checks a random sample of decisions, accuracy and reversal rates per moderator | Catches inconsistent or biased calls | audit ledger, appeals |
| 5 | **Legal requests desk**: copyright (DMCA-style) takedowns with counter-notice, court orders, preservation holds, an export package for an account | The table exists, there is no process | `legal_requests`, evidence tables |
| 6 | **Child-safety escalation**: a fast lane that hides at once, locks the account, preserves evidence and routes to a named responder | Highest-severity category must not wait in a normal queue | report priority, approval queue |
| 7 | **Notices and appeals for content removals**: every removal tells the author which rule it broke and lets them appeal (appeals today cover suspensions) | Fairness and legal expectations in many countries | `submit_appeal`, `audit_to_user_notice` |
| 8 | **Reporter feedback**: tell the reporter the outcome, and track repeat false reporters | Keeps the report channel useful | `report_outcome` notification already exists |
| 9 | **Marketplace, jobs and pitch moderation**: new-seller review before listings go live, fake job and scam detection (off-platform payment requests, "pay a fee to apply"), fake and review-bombed ratings, a dispute centre | These are the places money and fraud meet | vendor verification queues, ratings |
| 10 | **Trust and safety analytics**: report volume by reason, repeat offenders, time to action, language and region coverage, a periodic transparency report | Lets you staff and tune rules with evidence | `get_admin_stats`, `get_risk_distribution` |
| 11 | **Staff accountability**: anomaly alerts on staff behaviour (many audited visits, many lookups of one person), a quarterly role re-certification, an access log of who viewed what | Staff are the highest-privilege users | audit ledger, audited access |
| 12 | **Operations tools**: kill switches per feature with a reason and timer, incident notes, a safe read-only "see what this user sees" view, bulk actions with a preview | Faster, safer response | `platform_flags`, `system_incidents` |

Staff rules from `docs/STAFF_ACCOUNT_RULES.md` stay: staff do not post, message, apply, rate or buy. Anything above that needs a staff member to act as a normal user is the wrong design.

---

## 3. Payments: how they should flow, and what to prepare now

### 3.1 Where money could enter the product

The code today has **no payment code at all**. Prices exist only as display fields: gear listings (`price_per_day`, `price_per_week`), bookings (`total_price`, `status`), jobs (`salary_min`, `salary_max`), pitch calls (`budget_range`, `compensation`), vendor services, and project budgets. There is one flag, `monetization_disabled`, that staff can set on an account.

Candidate revenue and money flows, in the order I would introduce them:

1. **Gear rental bookings** (renter pays, owner receives, platform keeps a fee). The strongest first case: the booking flow already exists.
2. **Vendor service quotes** (accepted quote becomes an order).
3. **Subscriptions** for studios and professionals (higher limits, verified badge priority, analytics).
4. **Promotions**: featured jobs, boosted listings, promoted pitches.
5. **Paid pitch calls and crew payments** (paying people for work).
6. **Tips or paid content** (only if you want creator monetization; the staff flag already anticipates it).

### 3.2 Principles (decide these once)

- **Never touch card data.** Use a hosted checkout from a licensed provider. The app stores provider ids only.
- **Do not hold other people's money yourself.** In India, collecting and settling for third parties is a regulated activity. Use a provider's marketplace or split-settlement product (for example Razorpay Route, Cashfree Easy Split, or Stripe Connect for international sellers) so that the licensed provider holds the funds. Confirm the exact model with your accountant and a lawyer before launch.
- **Money is an integer in the smallest unit plus a currency** (for example 150000 paise and `INR`). Never a decimal or a float.
- **Everything that moves money writes to an immutable ledger.** Balances are always derived from the ledger, never edited.
- **The provider webhook is the source of truth for "paid"**, not the app screen. Webhooks are verified, idempotent and replay-safe.
- **Only server code writes payment data.** The app asks an edge function to create an order; users can read their own rows and nothing else.
- **Staff accounts never transact** (consistent with the staff rules). Finance staff are a separate role with their own screens.

### 3.3 The data model (sketch)

```
payment_accounts      one per person or business: provider customer id, connected seller id, payout status
kyc_profiles          legal name, PAN or tax id (encrypted), bank verification status, verified_at   (sellers only)
orders                what is being bought: kind (booking, quote, subscription, promotion), subject id,
                      buyer, seller, amount, currency, fee breakdown, status, expires_at
payments              one attempt to pay an order: provider payment id, status, method, failure reason
refunds               order, payment, amount, reason, requested_by, approved_by, status
disputes              chargebacks and user disputes: order, opened_by, evidence, deadline, outcome
ledger_entries        double entry: account, debit or credit, amount, currency, order, kind, created_at (append only)
payouts               seller, amount, period, status, provider payout id, hold reason
fee_rules             percentage and fixed fee by kind, tier and date range (so changes are versioned, not edited)
tax_rates / invoices  tax lines per order, numbered invoices (GST) generated from the order, never edited afterwards
provider_events       every webhook received: event id (unique), payload, processed_at, result  (idempotency)
```

Row access: users read only their own orders, payments, refunds and payouts. Writes happen only through edge functions with the service role. Finance staff read through narrow, audited functions. The ledger table has no update or delete permission for anybody.

### 3.4 The flows

**Gear rental booking (happy path)**

1. Renter requests dates. The owner accepts. The booking becomes `awaiting_payment` and an `order` is created with the price, fee and tax already calculated and stored.
2. The app asks `create-order` for a checkout. The provider's hosted page takes payment.
3. The provider calls our webhook. We verify the signature, store the event, and (once only) mark the payment `captured`, the order `paid`, the booking `confirmed`, and write ledger entries: buyer paid, platform fee, seller payable, tax.
4. Both people get a notification and an invoice.
5. After the rental ends (or a fixed window with no dispute), the seller's payable becomes `releasable`. The scheduled payout job pays it out, minus any holds, and writes the payout and ledger entries.

**Cancellation and refund:** the booking rules decide the refund amount (for example full before 48 hours, half after, none after pick-up). A refund is a new row and new ledger entries, never an edit. Refunds above a set amount need a second approver (the maker-checker queue already exists for this kind of thing).

**Dispute:** either person opens one before the release date. The payout for that order is held. A staff member with the finance or trust role reviews evidence, decides (refund, partial, release), and the decision is logged. A card chargeback arrives by webhook and creates the same dispute record automatically with the provider's deadline.

**Subscriptions:** plan, price and trial in the database; the provider owns the billing schedule. Webhooks drive `active`, `past_due`, `cancelled`. Features check a single `entitlements` view, not the provider. Failed payments follow a fixed grace period before limits apply.

**Order states (single state machine for every kind of order):**
`created → awaiting_payment → paid → fulfilled → settled`, with side exits `expired`, `cancelled`, `refunded`, `partially_refunded`, `disputed`. Only the webhook handler and a few server functions may move an order, and every move is an audit line.

### 3.5 How moderation and payments must connect

- A **ban or suspension** freezes new orders and payouts for that account. A **monetization_disabled** flag (already exists) blocks selling and promotions but allows buying.
- **Fraud checks before payment**: velocity limits for new accounts, a lower limit until the first successful order, matching device and IP risk (the data that is collected today), and manual review above a threshold.
- **Content rules for money**: listings or messages that ask people to pay outside the platform are a reportable reason and an automated rule.
- **Staff cannot buy or sell.** A separate finance role (view, refund with approval, hold or release payouts) is not a moderator and not a normal user.
- Every money action by staff is in the audit ledger with a reason, and large ones go through maker-checker.

### 3.6 Platform details that bite later

- **App stores:** digital goods bought inside the mobile apps (subscriptions, boosts, paid content) must use Apple and Google in-app purchase and pay their fee. Physical rentals and real-world services do not. Decide per product before building the mobile screens.
- **Tax and invoices (India):** GST invoices with sequential numbers, GST on the platform fee, and possible TCS and TDS duties for marketplaces. This needs an accountant's decision, but the order, fee breakdown and invoice tables above are built to carry it.
- **Seller verification:** payouts need KYC and a verified bank account. Collect it when someone first lists something for money, not at sign-up.
- **Terms:** refund policy, cancellation policy, fee schedule and dispute process are pages that must exist and be linked at checkout.
- **Reconciliation:** a daily job compares provider reports with the ledger and raises any difference as a finance alert.

### 3.7 What to do now so payments are easy later (no money moves yet)

1. Add a single money convention (integer minor units and currency) to the booking, quote, listing and job price fields, with a migration that keeps the current numbers.
2. Create the `orders`, `ledger_entries` and `provider_events` tables with the access rules above, and the order state machine as database functions. No provider connected.
3. Add a `payments_enabled` platform flag (the flag system exists) and keep it off.
4. Add a **finance role** and a **Finance** tab to the admin console (empty states: orders, refunds queue, disputes, payout holds, reconciliation). Add `finance` to the staff notification allow list.
5. Write the fee, refund and dispute policies and link them from the booking screens.
6. Pick the provider and run the checkout in test mode for gear bookings only.
7. Then payouts and refunds, then disputes tooling, then subscriptions and promotions.

---

## 4. Suggested order of work

1. Audited-access approval queue and notifications (small, fixes something broken).
2. Staff security: two-factor for staff, session limits, role re-certification.
3. Automated detection rules and the ban-evasion view (largest safety gain).
4. Notices and appeals for content removals, reporter feedback.
5. Service levels, workload and quality review.
6. Legal requests desk and child-safety lane.
7. Payments preparation (section 3.7), then a test-mode checkout for gear bookings.

## 5. Decisions needed from you

- Which payment flow comes first: gear bookings, vendor quotes, subscriptions, or something else?
- India only at first, or international sellers and buyers too (this decides the provider)?
- Should the platform hold payouts until the rental ends, and for how long?
- Do you want a separate finance team role, or will admins handle refunds?
- Are paid features expected inside the mobile apps (in-app purchase rules apply)?
