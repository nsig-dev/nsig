# nsig

Fire realistic, correctly-signed **sequences** of third-party webhook events at a local
or deployed endpoint — so you can test webhook handlers against real-world event ordering
and edge cases, without producing the events for real.

A single MIT-licensed CLI, published on npm as `nsig`.

## Quickstart

From the root of the app you want to test:

```bash
npx nsig init       # detects your provider + webhook-secret env var, scaffolds a scenario
npm install         # init adds nsig to devDependencies (scenarios import from it)
npx nsig run scenarios/stripe-starter.ts
# subscription.created → payment_failed ×2 → subscription.deleted
# all correctly signed, against your handler, in seconds.
```

nsig is a devDependency of your project (like a `vite.config` importing `vite`), so
scenario files get full type-safety and autocomplete from `import { defineScenario } from "nsig"`.

`init` reads your `package.json` and `.env`, figures out the provider (Stripe, GitHub, …)
and which env var holds the signing secret — whatever you happen to call it
(`STRIPE_WEBHOOK_SECRET`, `STRIPE_WH_SECRET`, `WH_SECRET_STRIPE`, `GH_WEBHOOK_SECRET`, …) —
and writes a ready-to-run scenario with those values filled in. It will never mistake an
API or publishable key for a webhook secret.

## Secrets: no exports, ever

A webhook signing secret is shared between the sender and your handler. nsig only ever
stores the env-var **name** in the scenario (so scenarios are safe to commit):

```ts
secret: { env: "STRIPE_WH_SECRET" }   // the name your codebase uses
```

At run time nsig reads that name from the environment, auto-loaded from `.env` in the
current directory — the same file your app uses. So you never `export` anything.

```bash
nsig run scenarios/stripe-starter.ts            # reads ./.env
nsig run scenarios/stripe-starter.ts --env-file ../app/.env   # or point elsewhere
nsig run scenarios/stripe-starter.ts --secret-env STRIPE_WH_SECRET   # override the name
```

The value is yours to choose for local testing (any string works, as long as your app
verifies with the same one). You only need a real `whsec_…` when testing against actual
Stripe deliveries — and even then it just lives in your `.env`.

## Targeting your endpoint

A scenario's `target` is a **full URL** — host, port, and path:

```ts
target: "http://localhost:8080/api/v1/webhooks/stripe"
```

Override it per run without editing the file:

```bash
nsig run scenarios/stripe-starter.ts --target http://localhost:8080/api/v1/webhooks/stripe
```

Need a backend to fire at? The sibling [`nsig-testbed`](../nsig-testbed) repo is a small
Express app with realistic endpoints that verifies with Stripe's official SDK — and that
you can also point the real Stripe CLI at, to compare synthetic vs. real events.

## Authoring scenarios

Scenarios are type-safe TypeScript (or hand-edited YAML/JSON, same schema):

```ts
import { defineScenario, ref } from "nsig";

export default defineScenario({
  name: "subscription-dunning",
  provider: "stripe",
  target: "http://localhost:3000/api/v1/webhooks/stripe",
  secret: { env: "STRIPE_WEBHOOK_SECRET" },
  context: {
    customer: { id: "cus_{{seed}}", email: "{{faker.internet.email}}" },
    subscription: { id: "sub_{{seed}}", customer: ref("customer.id") },
  },
  steps: [
    { event: "customer.subscription.created", expect: { status: 200 } },
    { event: "invoice.payment_failed", delayMs: 1000, expect: { status: 200 } },
    { event: "customer.subscription.deleted", delayMs: 1000, expect: { status: 200 } },
  ],
});
```

`{{seed}}` and `ref()` keep entities consistent across steps (the customer created in
step 1 is the one cancelled in step 3); a seeded faker makes runs reproducible.

Every step expects a **2xx** response by default — a handler that 4xx/5xx's on a valid
signed event fails the run. To assert a specific status (e.g. testing that bad input is
rejected), set it explicitly: `expect: { status: 400 }`.

## CI

```bash
nsig run scenarios/stripe-starter.ts --ci   # JSON to stdout, non-zero exit on failure
```

## Layout (single package)
```
src/
  cli.ts          CLI entry (bin: nsig)
  index.ts        library entry (defineScenario, ref, run, types)
  commands/       run, fire, list, init, login, listen
  render/         live (TTY) + ci (JSON) renderers
  core/           scenario schema, runner, sequencing, expectations
  signing/        HMAC schemes (Stripe, GitHub, Shopify, Svix, Twilio)
  providers/      per-provider defs (events, templates, signing config)
  schemas/        versioned payload templates (generated)
scripts/generate.ts   template generation pipeline
scenarios/            example/flagship scenarios
```

The engine (`core`/`providers`/`signing`) imports nothing beyond `crypto`/`fetch`, so it
stays portable; tsup bundles everything into `dist/` for publishing.

See `CLAUDE.md` for development rules.

## Edge cases (what `stripe trigger` can't do)

Real webhooks arrive duplicated, out of order, and get redelivered on failure.
nsig makes those first-class:

```ts
steps: [
  // duplicate delivery — same id twice; your handler must be idempotent
  { event: "invoice.payment_failed", id: "evt_1", repeat: 2 },

  // provider redelivery — resend on failure until 2xx (or give up)
  { event: "customer.subscription.deleted", retry: { times: 3 } },
]
```

- `id` pins the event id so a later step can redeliver the exact same event.
- `repeat: N` sends N byte-identical copies (idempotency testing).
- `retry: { times, onlyIf }` resends on failure (`onlyIf` defaults to `non-2xx`),
  collapsing to a single result that passes if the handler eventually accepts it.
- `nsig run <scenario> --shuffle` delivers steps in a **seeded, reproducible**
  out-of-order permutation — does your handler survive a `deleted` before a `created`?
