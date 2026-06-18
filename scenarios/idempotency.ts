import { defineScenario } from "nsig";

/**
 * Edge cases that `stripe trigger` can't produce: duplicate delivery and
 * provider redelivery/retry. Fire at a handler to test idempotency + retry tolerance.
 */
export default defineScenario({
  name: "stripe-idempotency",
  provider: "stripe",
  apiVersion: "2024-06-20",
  target: "http://localhost:3000/api/v1/webhooks/stripe",
  secret: { env: "STRIPE_WEBHOOK_SECRET" },
  steps: [
    // Same event id delivered twice — your handler must process it exactly once.
    { event: "invoice.payment_failed", id: "evt_dunning_1", repeat: 2 },
    // Flaky receiver: resend up to 3x until it returns 2xx (mimics Stripe redelivery).
    { event: "customer.subscription.deleted", retry: { times: 3 } },
  ],
});
