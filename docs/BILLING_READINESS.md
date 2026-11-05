# Billing: built now, switched on later

The app is in beta: every feature is free. Billing is already built around that, so charging is a switch and a provider, not a rebuild.
Nothing here changes what anybody can do while `billing_mode` is `beta`.

## What exists today

| Piece | Where | Role |
| --- | --- | --- |
| Mode and switches | `platform_settings`: `billing_mode`, `billing_beta_ends_at`, `payments_enabled` | beta (all free) or live; going live needs payments on |
| Plans and what they include | `plans`, `plan_entitlements` (SQL part BV) | features on or off, limits, unlimited. Drafts, copied from `types/pricing.ts`, none active but Fan |
| Who has what | `subscriptions` (person or company page), `entitlement_overrides` | status `beta`, `trialing`, `active`, `past_due`, `cancelled`, `expired`; comps and founding members |
| Answering "may I?" | `my_entitlements()`, `has_entitlement()`, `entitlement_limit()`; `packages/core/src/billing.ts`, `useEntitlements`, `FeatureGate` | one place decides; every screen and trigger asks it. In beta: yes, unlimited |
| Limits in the database | triggers on projects, private rooms, portfolio items and job postings | silent in beta; in live they refuse a row over the limit with "Your plan allows N of these" |
| Money records | `orders`, `payments`, `refunds`, `ledger_entries` (append only), `fee_rules`, `provider_events` | no policy lets the app write to them; people read only their own orders |
| The one function that moves money state | `billing_apply_event()` | server only; takes a normalised event, idempotent, writes the ledger |
| Provider plug | `supabase/functions/_shared/billing/` (adapter and providers), `billing-webhook`, `create-checkout` | stubs that refuse to run until a provider is implemented |
| Admin | Super admin console, Billing tab | mode, payments switch, the "if we went live today" report, founding-member grants |
| Separate paid products | part BX, `products`, `product_grants`, Billing tab → Separate paid products | Business verification (a paid review, not a paid badge) and Marketplace seller, each bought on its own, outside any plan. Free and unenforced in beta |
| Gifts | part BW, Billing tab → Send a gift, `/gifts` | team-to-user gifts (a plan or a feature for some days), accepted in the account, no codes; days start at go-live if accepted in beta |
| Mobile | `PlansScreen`, `GiftsScreen`, `MyPaymentsScreen` in `apps/mobile/src/screens/billing`, reached from the More menu and from notifications |  the same database calls as the web pages; hidden and blocked for staff |
| Public | `/plans` | shows each plan and the beta notice; buttons say "Free during the beta" |
| Refunds, disputes, payouts | part CA, Payments tab → Refunds / Disputes / Payouts; edge function `process-refund` | a large refund or payout needs a different admin (a very large refund a super admin); an approved refund is sent to the provider and its confirmation completes it in the ledger; a disputed order's payout is held; a refunded or disputed verification cannot be approved without a recorded override. Thresholds are rows in `platform_settings` |
| My payments | part CB, `/payments` (web) and the My payments screen (mobile); edge function `manage-subscription` | the user's plan and renewal, stop or keep renewing, products and gifts held, receipts, report a problem, payouts for sellers |
| Scheduled jobs | part CB, `billing_run_scheduled_jobs()`, Billing tab → Scheduled jobs | hourly with pg_cron; ends trials, founding periods, gifts, unfinished checkouts, paid products, seller listings and badges; a super admin can run it by hand |

Rules built in on purpose: money is an integer in minor units plus a currency; prices come from the database, never from the app;
a payment that does not match its order is not applied; a replayed webhook does nothing the second time; staff accounts never buy or sell;
a billing problem can never lock people out (the app falls back to "unlocked" if the billing call fails).

## The day we want to charge

1. **Decide the model and the numbers.** Edit `plans` and `plan_entitlements` (price, `is_active`, limits). Add `fee_rules` for commissions.
2. **Pick a provider** (Razorpay is the natural first choice for India; Stripe Connect for international sellers). Implement its file in
   `_shared/billing/` (`verifyAndParseWebhook`, `createCheckout`) and add it to `providers.ts`. Set its secrets.
3. **Deploy** `billing-webhook` and `create-checkout`. Register `https://<project>.functions.supabase.co/billing-webhook?provider=<id>` in the provider.
4. **Test in the provider's test mode.** Turn *Payments* on in the Billing tab (this does not charge anyone; the mode is still beta), buy a plan with a test card,
   and check the order moves to `paid`, a subscription appears, and the ledger lines add up.
5. **Run "If we went live today"** in the Billing tab. It counts the accounts that already have more than the default plan allows.
6. **Give a soft landing.** Use *Founding members* to give everybody a plan for 60 to 90 days. When it ends they move to the default plan.
7. **Announce, then Go live** (set the beta end date first so `/plans` shows it). Plans and limits are enforced from that moment.
8. **Rollback:** turning payments off while live returns everybody to the free beta at once. Nothing is deleted.

## Still to decide or build when the time comes

- The business model itself (what is free, what is paid, prices) and whether a studio plan belongs to the company page.
- A provider and its fees; tax (GST invoices) and, for sellers, KYC and payouts.
- Screens that read `useEntitlements` in place of today's account-type checks (`isFan`), in the order you choose. Until then the existing checks stay.
- Payout, refund and dispute screens in the admin console (the tables and the ledger are ready).
- App-store rules for digital subscriptions bought inside the mobile apps. The mobile Plans screen has no buy button yet for that reason.
