# nsig — Agent Guide

`nsig` fires realistic, correctly-signed **sequences** of third-party webhook events at a
local or deployed endpoint, so webhook handlers can be tested against real-world event
ordering and edge cases. It is a single **MIT-licensed CLI**, published on npm as `nsig`,
that also exposes a small library API (`defineScenario`, `ref`, `run`) for authoring
scenarios in TypeScript.

## Architecture invariant (do not break)
The signing, payload-template, and scenario-engine logic live in self-contained `src/`
folders with a strict, one-way dependency direction. One source of truth, zero drift.

- Dependency direction (strict): `cli` → `core` → `providers` → `signing` + `schemas`.
- **Nothing in `core` / `providers` / `signing` may import Node-only server APIs beyond
  `crypto` / `fetch`.** Keep the engine portable (browser/edge-capable).

## Package
Single npm package (`nsig`), bundled with tsup. Dual entry:
- `src/cli.ts` → the `nsig` bin.
- `src/index.ts` → the library export consumed by `import { defineScenario } from "nsig"`.

```
src/{cli.ts,index.ts}  src/commands  src/render
src/core  src/signing  src/providers  src/schemas
scripts/generate.ts    scenarios/
```

Package manager: yarn. Build: tsup. Tests: vitest.

---

# Development Rules

## Dependency Rules
- Do not recreate library code.
- Assume libraries should be installed, not hand-written.

## File Creation Rules
Only create:
- feature code / business logic (the engine: scenario model, runner, signers, provider defs)
- CLI commands
- hooks / services

Do NOT create / write:
- generated files
- **generated payload templates** (`src/schemas/templates/*` come from the
  `scripts/generate.ts` pipeline — edit the *transform*, not the artifacts; the few
  curated samples checked in for MVP are the documented exception)
- lockfiles
- package manager outputs

## Ask Before Scaffolding
If more than 3 files are required:
- propose plan first
- ask approval

## After Implementing
When done creating the appropriate files, give me the **exact commands to run, step by
step**, so any generated outputs (templates, builds, etc.) can be produced — list the
commands rather than hand-writing the outputs.

## Signing is the kernel — treat it as such
`src/signing` must be golden-tested against each provider's *own* published verification
snippet (Stripe, GitHub, Shopify, Svix). Never change a signer without updating/extending
its golden test.
