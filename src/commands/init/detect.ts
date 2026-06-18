/**
 * Pure detection helpers for `nsig init` — no I/O, fully unit-testable.
 * The command layer (./index.ts) does the file reads and prompts.
 */

export const SUPPORTED_PROVIDERS = ["stripe", "github"] as const;
export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

export type DetectedProvider = "stripe" | "github" | "clerk" | "shopify" | "twilio";

interface PackageJsonish {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/** Detect which webhook providers a project uses from its package.json deps. */
export function detectProviders(pkg: PackageJsonish | null): DetectedProvider[] {
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const names = Object.keys(deps);
  const has = (pred: (d: string) => boolean) => names.some(pred);
  const found: DetectedProvider[] = [];
  if ("stripe" in deps) found.push("stripe");
  if (has((d) => d === "octokit" || d.startsWith("@octokit/") || d.includes("github"))) found.push("github");
  if ("svix" in deps || has((d) => d.startsWith("@clerk/"))) found.push("clerk");
  if (has((d) => d.includes("shopify"))) found.push("shopify");
  if ("twilio" in deps) found.push("twilio");
  return found;
}

const PROVIDER_ALIASES: Record<string, RegExp> = {
  stripe: /stripe/,
  github: /github|(^|_)gh(_|$)/,
  clerk: /clerk|svix/,
  shopify: /shopify|(^|_)shop(_|$)/,
  twilio: /twilio/,
};

function providerMatches(key: string, provider: string): boolean {
  const re = PROVIDER_ALIASES[provider];
  return re ? re.test(key) : key.includes(provider);
}

/**
 * Score how likely an env-var name is THIS provider's webhook signing secret.
 * 0 means "not a webhook secret" (e.g. an API or publishable key). Higher is better.
 */
export function scoreSecretKey(key: string, provider: string): number {
  const k = key.toLowerCase();
  if (!providerMatches(k, provider)) return 0;
  const webhooky = /whsec|webhook|hook|(^|_)wh($|_)|sig/.test(k);
  if (!webhooky) return 0;
  let s = 1;
  if (/whsec/.test(k)) s += 4;
  if (/webhook|hook/.test(k)) s += 3;
  if (/(^|_)wh($|_)/.test(k)) s += 2;
  if (/secret/.test(k)) s += 2;
  if (/sig/.test(k)) s += 1;
  if (/publishable|api[_-]?key|secret[_-]?key/.test(k)) s -= 5;
  return s;
}

/** Pick the best-matching webhook-secret env var for a provider, if any. */
export function detectSecretEnvVar(envKeys: string[], provider: string): string | undefined {
  const ranked = envKeys
    .map((k) => ({ k, s: scoreSecretKey(k, provider) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.k.length - b.k.length);
  return ranked[0]?.k;
}

export function defaultSecretEnv(provider: string): string {
  return `${provider.toUpperCase()}_WEBHOOK_SECRET`;
}

export function defaultTarget(provider: string): string {
  return `http://localhost:3000/api/v1/webhooks/${provider}`;
}

export interface ScaffoldOptions {
  provider: SupportedProvider;
  name: string;
  secretEnv: string;
  target: string;
}

/** Generate the TypeScript source for a starter scenario. */
export function scenarioTemplate(o: ScaffoldOptions): string {
  if (o.provider === "github") {
    return `import { defineScenario } from "nsig";

export default defineScenario({
  name: "${o.name}",
  provider: "github",
  target: "${o.target}",
  secret: { env: "${o.secretEnv}" },
  steps: [
    { event: "pull_request", patch: { action: "opened" }, expect: { status: 200 } },
    { event: "pull_request", delayMs: 500, patch: { action: "synchronize" } },
    {
      event: "pull_request",
      delayMs: 500,
      patch: { action: "closed", pull_request: { merged: true } },
      expect: { status: 200 },
    },
  ],
});
`;
  }
  return `import { defineScenario, ref } from "nsig";

export default defineScenario({
  name: "${o.name}",
  provider: "stripe",
  apiVersion: "2024-06-20",
  target: "${o.target}",
  secret: { env: "${o.secretEnv}" },
  context: {
    customer: { id: "cus_{{seed}}", email: "{{faker.internet.email}}" },
    subscription: { id: "sub_{{seed}}", customer: ref("customer.id") },
  },
  steps: [
    { event: "customer.subscription.created", expect: { status: 200 } },
    { event: "invoice.payment_failed", delayMs: 1000, patch: { data: { object: { attempt_count: 1 } } }, expect: { status: 200 } },
    { event: "customer.subscription.deleted", delayMs: 1000, expect: { status: 200 } },
  ],
});
`;
}

export function isSupported(p: string): p is SupportedProvider {
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(p);
}
