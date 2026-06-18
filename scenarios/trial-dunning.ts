import { defineScenario } from "nsig";

/**
 * trial → active → dunning → canceled — the flow you'd normally need a Stripe
 * test clock for. Time fields use {{now±}} tokens, so trial/retry boundaries are
 * realistic without advancing any clock. Runs in seconds; replay forever in CI.
 */
export default defineScenario({
  name: "trial-to-dunning",
  provider: "stripe",
  apiVersion: "2024-06-20",
  target: "http://localhost:3000/api/v1/webhooks/stripe",
  secret: { env: "STRIPE_WEBHOOK_SECRET" },
  context: { subscription: { id: "sub_{{seed}}", customer: "cus_{{seed}}" } },
  steps: [
    // 14-day trial begins now, ends in two weeks
    {
      event: "customer.subscription.created",
      patch: { data: { object: { status: "trialing", trial_end: "{{now+14d}}" } } },
    },
    // trial converts (as if the clock advanced past trial_end)
    {
      event: "customer.subscription.updated",
      patch: { data: { object: { status: "active" } } },
    },
    // renewal fails twice — dunning — with a real next-attempt time
    {
      event: "invoice.payment_failed",
      id: "evt_dun_1",
      patch: { data: { object: { attempt_count: 1, next_payment_attempt: "{{now+3d}}" } } },
    },
    {
      event: "invoice.payment_failed",
      id: "evt_dun_2",
      patch: { data: { object: { attempt_count: 2, next_payment_attempt: "{{now+5d}}" } } },
    },
    // Stripe gives up; subscription canceled now
    {
      event: "customer.subscription.deleted",
      patch: { data: { object: { status: "canceled", canceled_at: "{{now}}" } } },
    },
  ],
});
