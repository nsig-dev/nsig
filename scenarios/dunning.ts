import { defineScenario, ref } from "nsig";

/**
 * Flagship demo: subscription dunning.
 *   created -> payment_failed x2 -> deleted, all correctly signed.
 * `npx nsig run scenarios/dunning.ts`
 */
export default defineScenario({
  name: "subscription-dunning",
  provider: "stripe",
  apiVersion: "2024-06-20",
  target: "http://localhost:3000/api/v1/webhooks/stripe",
  secret: { env: "STRIPE_WEBHOOK_SECRET" },
  context: {
    customer: { id: "cus_{{seed}}", email: "{{faker.internet.email}}" },
    subscription: { id: "sub_{{seed}}", customer: ref("customer.id") },
  },
  steps: [
    { event: "customer.subscription.created", patch: { data: { object: { status: "active" } } }, expect: { status: 200 } },
    { event: "invoice.payment_failed", delayMs: 1000, patch: { data: { object: { attempt_count: 1 } } }, expect: { status: 200 } },
    { event: "invoice.payment_failed", delayMs: 1000, patch: { data: { object: { attempt_count: 2 } } } },
    { event: "customer.subscription.deleted", delayMs: 1000, expect: { status: 200 } },
  ],
});
