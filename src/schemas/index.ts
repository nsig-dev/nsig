/**
 * Versioned payload templates, keyed `provider/apiVersion/event`.
 *
 * Templates are GENERATED from providers' machine-readable specs
 * (see ../../scripts/generate.ts) and committed as artifacts — never hand-written.
 * A few curated samples are checked in so the engine is runnable before the full
 * generation pipeline lands (Phase 1.5).
 */
import stripeSubCreated from "./templates/stripe/2024-06-20/customer.subscription.created.json";
import stripeInvoiceFailed from "./templates/stripe/2024-06-20/invoice.payment_failed.json";
import stripeSubDeleted from "./templates/stripe/2024-06-20/customer.subscription.deleted.json";
import githubPullRequest from "./templates/github/latest/pull_request.json";
import githubPush from "./templates/github/latest/push.json";
import githubIssues from "./templates/github/latest/issues.json";

type TemplateKey = `${string}/${string}/${string}`;

const REGISTRY: Record<TemplateKey, object> = {
  "stripe/2024-06-20/customer.subscription.created": stripeSubCreated,
  "stripe/2024-06-20/invoice.payment_failed": stripeInvoiceFailed,
  "stripe/2024-06-20/customer.subscription.deleted": stripeSubDeleted,
  "github/latest/pull_request": githubPullRequest,
  "github/latest/push": githubPush,
  "github/latest/issues": githubIssues,
};

export function getTemplate(
  provider: string,
  event: string,
  apiVersion = "latest",
): object | undefined {
  const key = `${provider}/${apiVersion}/${event}` as TemplateKey;
  const tpl = REGISTRY[key];
  return tpl ? structuredClone(tpl) : undefined;
}

export function hasTemplate(provider: string, event: string, apiVersion = "latest"): boolean {
  return `${provider}/${apiVersion}/${event}` in REGISTRY;
}
