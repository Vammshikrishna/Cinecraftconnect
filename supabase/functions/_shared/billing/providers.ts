// The providers we can talk to. Each one is a stub until it is implemented: it refuses to run rather than guess.
// Implement one (verifyAndParseWebhook and createCheckout), add its secrets, and it works end to end, because the
// database side (orders, ledger, subscriptions, entitlements) already exists.
import { type PaymentProvider, ProviderNotConfigured } from "./adapter.ts";

const notReady = (id: string): PaymentProvider => ({
  id,
  verifyAndParseWebhook: () => Promise.reject(new ProviderNotConfigured(id)),
  createCheckout: () => Promise.reject(new ProviderNotConfigured(id)),
  refund: () => Promise.reject(new ProviderNotConfigured(id)),
  setCancelAtPeriodEnd: () => Promise.reject(new ProviderNotConfigured(id)),
});

// Suggested first choice for India: Razorpay (UPI, cards, netbanking, subscriptions, and Route for splitting a sale
// between the platform and a seller). Stripe Connect fits international sellers. Secrets would be, for example,
// RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET.
export const PROVIDERS: Record<string, PaymentProvider> = {
  razorpay: notReady("razorpay"),
  stripe: notReady("stripe"),
};

export const getProvider = (id: string | null): PaymentProvider | null => (id && PROVIDERS[id]) || null;
