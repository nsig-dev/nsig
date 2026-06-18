import { getProvider } from "../providers/index.js";
import type { Scenario } from "./schema.js";
import type { RunnerEvent, ScenarioRun, StepResult } from "./events.js";
import { deepMerge, hashSeed, resolveTree, seededFaker, seededOrder } from "./resolve.js";

export interface RunOpts {
  signal?: AbortSignal;
  /** Resolve a secret reference to its value (env/keychain lookup lives in the caller). */
  resolveSecret: (secret: Scenario["secret"]) => string;
  /** Deliver steps in a seeded, out-of-order permutation. */
  shuffle?: boolean;
  /** Injected for tests; defaults to global fetch. */
  fetch?: typeof fetch;
  /** Injected for tests; defaults to real timers. */
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const is2xx = (s?: number) => s != null && s >= 200 && s < 300;

/**
 * Pure orchestration: resolve payload -> sign -> fetch -> assert. Emits a
 * RunnerEvent stream; does no console I/O. Supports the edge-case primitives
 * `stripe trigger` can't: pinned ids, duplicate delivery (repeat), retry-on-
 * failure, and seeded out-of-order delivery (shuffle).
 */
export async function* run(scenario: Scenario, opts: RunOpts): AsyncIterable<RunnerEvent> {
  const doFetch = opts.fetch ?? fetch;
  const sleep = opts.sleep ?? realSleep;
  const seed = scenario.seed ?? hashSeed(scenario.name);
  const faker = seededFaker(seed);
  const provider = getProvider(scenario.provider);
  const secret = opts.resolveSecret(scenario.secret);
  const context = resolveTree(scenario.context, {}, seed, faker);

  const startedAt = new Date().toISOString();
  const results: StepResult[] = [];
  yield { type: "scenario:start", scenario: scenario.name, seed };

  const order = opts.shuffle
    ? seededOrder(scenario.steps.length, seed)
    : scenario.steps.map((_, i) => i);

  for (const i of order) {
    const step = scenario.steps[i]!;
    if (opts.signal?.aborted) break;
    if (step.delayMs) await sleep(step.delayMs);
    yield { type: "step:start", index: i, event: step.event };

    // Build the payload + body ONCE so repeats/retries are byte-identical (same id).
    const base = provider.resolveTemplate(step.event, scenario.apiVersion);
    const withCtx = resolveTree(base, context, seed, faker);
    const payload = deepMerge(withCtx, resolveTree(step.patch, context, seed, faker)) as Record<string, unknown>;
    if (step.id) payload.id = step.id;
    const body = JSON.stringify(payload);

    const deliverOnce = async (): Promise<StepResult> => {
      const headers = { "Content-Type": provider.contentType, ...provider.signer.sign({ body, secret }) };
      const t0 = Date.now();
      try {
        const res = await doFetch(scenario.target, { method: "POST", headers, body });
        const text = await res.text();
        const expect = step.expect;
        const statusOk = expect?.status != null ? res.status === expect.status : is2xx(res.status);
        const bodyOk = !expect?.bodyMatches || new RegExp(expect.bodyMatches).test(text);
        const reasons: string[] = [];
        if (!statusOk)
          reasons.push(expect?.status != null ? `expected status ${expect.status}, got ${res.status}` : `expected 2xx, got ${res.status}`);
        if (!bodyOk) reasons.push(`body did not match /${expect?.bodyMatches}/`);
        return {
          index: i,
          event: step.event,
          status: res.status,
          latencyMs: Date.now() - t0,
          passed: statusOk && bodyOk,
          error: reasons.length ? reasons.join("; ") : undefined,
        };
      } catch (err) {
        return {
          index: i,
          event: step.event,
          latencyMs: Date.now() - t0,
          passed: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    };

    // A single delivery, transparently retried on failure (collapsed to one result).
    const deliverWithRetry = async (): Promise<StepResult> => {
      let r = await deliverOnce();
      let tries = 0;
      if (step.retry) {
        const shouldRetry = () => (step.retry!.onlyIf === "always" ? true : !is2xx(r.status));
        while (!r.passed && shouldRetry() && tries < step.retry.times) {
          tries++;
          if (step.delayMs) await sleep(step.delayMs);
          r = await deliverOnce();
        }
      }
      if (tries) r.attempt = `after ${tries} retr${tries === 1 ? "y" : "ies"}`;
      return r;
    };

    // Duplicate delivery (idempotency): N byte-identical sends, all must pass.
    for (let d = 0; d < step.repeat; d++) {
      const r = await deliverWithRetry();
      if (step.repeat > 1) r.attempt = `dup ${d + 1}/${step.repeat}${r.attempt ? ` (${r.attempt})` : ""}`;
      results.push(r);
      yield { type: "step:result", result: r };
    }
  }

  const run: ScenarioRun = {
    scenario: scenario.name,
    startedAt,
    finishedAt: new Date().toISOString(),
    passed: results.every((r) => r.passed),
    steps: results,
  };
  yield { type: "scenario:done", run };
}
