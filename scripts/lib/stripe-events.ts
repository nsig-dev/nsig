/**
 * Resolve a Stripe event type (e.g. "customer.subscription.created") to the
 * components.schemas key of its `data.object` (e.g. "subscription").
 *
 * Stripe does NOT expose this mapping in the spec, so we use a rule that covers
 * the vast majority, plus the contract that anything unmapped is logged + skipped
 * by the generator (never silently wrong).
 */
export function eventToResource(type: string, has: (key: string) => boolean): string | undefined {
  const segs = type.split(".");
  if (segs.length < 2) return has(type) ? type : undefined;

  const parts = segs.slice(0, -1); // drop the trailing action (created/updated/…)
  const prefix = parts.join("."); // "customer.subscription" | "payment_intent" | "checkout.session"

  // 1) full dotted prefix is itself a schema: checkout.session, payment_intent
  if (has(prefix)) return prefix;
  // 2) dotted prefix -> underscores: source.transaction -> source_transaction
  const underscored = prefix.replace(/\./g, "_");
  if (has(underscored)) return underscored;
  // 3) last resource token: customer.subscription -> subscription, charge.dispute -> dispute
  const last = parts[parts.length - 1]!;
  if (has(last)) return last;
  // 4) first underscore -> dot: issuing_authorization -> issuing.authorization
  const dotted = prefix.replace("_", ".");
  if (has(dotted)) return dotted;

  return undefined;
}
