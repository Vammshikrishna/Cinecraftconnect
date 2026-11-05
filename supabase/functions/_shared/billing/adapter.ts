// The one place that knows about a payment provider. Everything else (the database, the screens, the other functions)
// speaks in the NORMALISED shapes below, so changing or adding a provider means writing one file here and nothing else.
//
// To add a provider: copy razorpay.ts, implement the two functions, add it to PROVIDERS, set its secrets, deploy.

/** What the database understands (see billing_apply_event in part_bv). */
export type NormalizedEvent =
  | { type: "payment.captured"; order_id: string; provider: string; provider_payment_id: string; amount_minor: number; method?: string }
  | { type: "payment.failed"; order_id: string; provider: string; provider_payment_id: string; reason?: string }
  | { type: "refund.processed"; order_id: string; provider: string; provider_refund_id: string; amount_minor: number; reason?: string }
  | { type: "dispute.opened"; order_id?: string; provider: string; provider_payment_id?: string; provider_dispute_id: string; amount_minor?: number; reason?: string; evidence_due_at?: string }
  | { type: "dispute.closed"; provider: string; provider_dispute_id: string; outcome: "won" | "lost" }
  | {
      type: "subscription.activated" | "subscription.renewed";
      owner_type: "user" | "page"; owner_id: string; plan_code: string; interval: "monthly" | "yearly";
      period_start: string; period_end: string; provider: string; provider_subscription_id: string; provider_customer_id?: string;
      // The provider's own time for this event. Real adapters should set it so a late, older event cannot overwrite newer state.
      occurred_at?: string;
    }
  | { type: "subscription.past_due" | "subscription.cancelled" | "subscription.expired"; provider: string; provider_subscription_id: string; occurred_at?: string };

export interface ParsedWebhook {
  /** the provider's own id for this delivery; the pair (provider, eventId) makes a replay harmless */
  eventId: string;
  eventType: string;
  payload: unknown;
  /** null when the event is real but is not one we act on */
  event: NormalizedEvent | null;
}

export interface CheckoutRequest {
  orderId: string;
  amountMinor: number;
  currency: string;
  buyerId: string;
  buyerEmail?: string;
  description: string;
  returnUrl: string;
  /** for subscriptions */
  planCode?: string;
  interval?: "monthly" | "yearly";
}

export interface RefundRequest {
  /** our refund id: also sent to the provider as a reference, so a retry never refunds twice */
  refundId: string;
  providerPaymentId: string;
  amountMinor: number;
  currency: string;
  reason: string;
}

export interface PaymentProvider {
  id: string;
  /** Verify the signature on the RAW body, then translate it. Throw if the signature is wrong. */
  verifyAndParseWebhook(rawBody: string, headers: Headers): Promise<ParsedWebhook>;
  /** Create the provider's order or hosted checkout. The returned providerOrderId is stored on our order. */
  createCheckout(req: CheckoutRequest): Promise<{ checkoutUrl: string; providerOrderId: string }>;
  /** Refund part or all of a captured payment. Must be safe to call twice with the same refundId. */
  refund(req: RefundRequest): Promise<{ providerRefundId: string; status: "processed" | "pending" }>;
  /** Stop a subscription renewing (at the end of the period), or take that back. */
  setCancelAtPeriodEnd(providerSubscriptionId: string, cancel: boolean): Promise<void>;
}

export class ProviderNotConfigured extends Error {
  constructor(provider: string) {
    super(`The payment provider "${provider}" is not configured yet`);
  }
}
