# nsig

**Test your webhook handlers against what production actually sends** — duplicate
deliveries, retries after failure, and out-of-order events — not just the one happy-path
event `stripe trigger` hands you. Correctly signed, fully local, in CI on every PR.

A single MIT-licensed CLI, published on npm as `nsig`.

## Why nsig, not `stripe trigger`?

`stripe trigger` fires one happy-path event through Stripe's servers. The events that
actually break handlers in production are the ones it *can't* send on demand — and
producing those is the whole point of nsig:

```ts
steps: [
  { event: "customer.subscription.created", id: "evt_created" },
  // the SAME event twice — does your handler double-charge / double-email?
  { event: "invoice.payment_failed", id: "evt_fail", repeat: 2 },
  // redelivered after your endpoint flaked — does it recover, or drop it?
  { event: "customer.subscription.deleted", retry: { times: 3 } },
]
```
```bash
nsig run scenarios/dunning.ts --shuffle    # also deliver out of order (reproducible)
```

Duplicate, retried, and out-of-order delivery are first-class primitives — the failure
modes `stripe trigger` structurally can't reproduce because it isn't the sender. On top of
that: real signatures, the full ~250-event Stripe catalog, multi-step sequences with
referential consistency, every provider in one tool, and a green/red exit code for CI.
**[Jump to the edge-case primitives ↓](#edge-cases--the-stripe-mvp)**

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

**Time without a clock.** Timestamp fields accept relative tokens — `{{now}}`,
`{{now+14d}}`, `{{now-1h}}` (units `s`/`m`/`h`/`d`/`w`) — so you can set `trial_end`,
`period_end`, or `next_payment_attempt` to realistic moments without Stripe's test-clock
dance. A single-token value resolves to a real number, so timestamps stay numeric. See
`scenarios/trial-dunning.ts` for a full trial → active → dunning → canceled flow.

Every step expects a **2xx** response by default — a handler that 4xx/5xx's on a valid
signed event fails the run. To assert a specific status (e.g. testing that bad input is
rejected), set it explicitly: `expect: { status: 400 }`.

## CI — regression-test webhooks on every PR

`nsig run --ci` prints the run as JSON and exits non-zero on any failure, so it drops
straight into a pipeline:

```bash
nsig run scenarios/stripe-starter.ts --ci
```

This repo also ships a composite **GitHub Action** (`action.yml`) that runs a set of
scenarios against a target and fails the check on regression. Point it at your app booted
in CI (or a deploy preview URL):

```yaml
name: Webhook tests
on: [pull_request]

jobs:
  webhooks:
    runs-on: ubuntu-latest
    env:
      # the signing secret your handler verifies with (any value; must match both sides)
      STRIPE_WEBHOOK_SECRET: ${{ secrets.STRIPE_WEBHOOK_SECRET }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci                      # installs nsig (a devDependency)
      - run: npm run start &             # boot the app under test…
      - run: npx wait-on http://localhost:3000/health   # …and wait for it
      - uses: nsig-dev/nsig@v1           # ← this repo, used as an action
        with:
          scenarios: "scenarios/*.ts"
          target: "http://localhost:3000/api/v1/webhooks/stripe"
          # shuffle: "true"              # also test out-of-order delivery
```

The action assumes nsig is a devDependency (so scenario `import "nsig"` resolves and the
`nsig` bin is on the local path) — run your install step first. Each scenario runs under
`::group::` log folding; any failure fails the job.

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

## Edge cases — the Stripe MVP

`stripe trigger` fires one happy-path event through Stripe's infrastructure. But the
events that actually break webhook handlers in production are the ones Stripe **won't
send you on demand**: the same event delivered twice, an event redelivered after your
endpoint blipped, or events arriving out of order. Producing those requires being the
*sender* — which is exactly what nsig is. These primitives are the core of what nsig does
for Stripe that nothing else does.

### Duplicate delivery — idempotency (`repeat` + `id`)

Stripe delivers **at-least-once**: the same event can arrive multiple times (network
retries, redelivery, your own 5xx-then-200). If your handler isn't idempotent, a single
`invoice.payment_failed` sends the dunning email twice, or a `checkout.session.completed`
provisions the account — and grants credits — twice.

```ts
{ event: "invoice.payment_failed", id: "evt_1", repeat: 2 }
```

`repeat: N` sends N **byte-identical** copies; pinning `id` fixes the dedup key
(`event.id`) your handler should be keying on. A correct handler acts on the first and
no-ops the rest while still returning 2xx every time — so all deliveries pass. If the
second delivery triggers a duplicate side effect, that's the bug this catches.

### Redelivery on failure (`retry`)

When your endpoint returns non-2xx — a deploy, a timeout, a transient bug — Stripe retries
with exponential backoff for up to ~3 days. Your handler has to tolerate being hit again
later and still converge to the right state.

```ts
{ event: "customer.subscription.deleted", retry: { times: 3 } }
```

`retry` resends on failure (`onlyIf: "non-2xx"` by default, or `"always"`) and collapses
to a single result that passes **if the handler eventually accepts it**. That lets you
assert "my endpoint recovers and the event isn't dropped," not just whether the first
attempt happened to land. Pair it with a flaky test handler to prove your retry tolerance.

### Out-of-order delivery (`--shuffle`)

Stripe makes **no ordering guarantees**. A `customer.subscription.updated` can land before
the `customer.subscription.created`; a `charge.refunded` before the `charge.succeeded`.
Handlers that assume arrival order silently corrupt state — and it's nearly impossible to
reproduce by hand.

```bash
nsig run scenarios/dunning.ts --shuffle           # seeded, reproducible permutation
nsig run scenarios/dunning.ts --shuffle --seed 7  # pin the exact order
```

Same seed → same order, so a failure you find locally reproduces byte-for-byte in CI.
Does your handler survive a `deleted` before a `created`?

### Putting it together

```ts
import { defineScenario, ref } from "nsig";

export default defineScenario({
  name: "dunning-resilience",
  provider: "stripe",
  apiVersion: "2024-06-20",
  target: "http://localhost:3000/api/v1/webhooks/stripe",
  secret: { env: "STRIPE_WEBHOOK_SECRET" },
  context: { subscription: { id: "sub_{{seed}}", customer: "cus_{{seed}}" } },
  steps: [
    { event: "customer.subscription.created", id: "evt_created" },
    // duplicate dunning event — handler must not double-charge/double-email
    { event: "invoice.payment_failed", id: "evt_fail_1", repeat: 2 },
    // redelivery — endpoint may flake, must still converge
    { event: "customer.subscription.deleted", id: "evt_deleted", retry: { times: 3 } },
  ],
});
```

Run it normally to test the happy path, then with `--shuffle` to test ordering — same
file, two failure modes. That combination — real signatures, real catalog, duplicate +
redelivery + reordering — is the Stripe testing story `stripe trigger` structurally can't
tell, and it's nsig's reason to exist.
