import { getProvider } from "../providers/index.js";
import type { Scenario } from "./schema.js";
import type { RunnerEvent, ScenarioRun, StepResult } from "./events.js";
import { deepMerge, hashSeed, resolveTree, seededFaker } from "./resolve.js";

export interface RunOpts {
  signal?: AbortSignal;
  /** Resolve a secret reference to its value (env/keychain lookup lives in the caller). */
  resolveSecret: (secret: Scenario["secret"]) => string;
  /** Injected for tests; defaults to global fetch. */
  fetch?: typeof fetch;
  /** Injected for tests; defaults to real timers. */
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * The runner is pure orchestration: resolve payload -> sign -> fetch -> assert.
 * It does NO console I/O. Presentation (CLI spinner, web SSE, CI JSON) subscribes
 * to the emitted RunnerEvent stream. Same code path drives all three surfaces.
 */
export async function* run(scenario: Scenario, opts: RunOpts): AsyncIterable<RunnerEvent> {
  const doFetch = opts.fetch ?? fetch;
  const sleep = opts.sleep ?? realSleep;
  const seed = scenario.seed ?? hashSeed(scenario.name);
  const faker = seededFaker(seed);
  const provider = getProvider(scenario.provider);
  const secret = opts.resolveSecret(scenario.secret);

  // Shared context resolved once -> referential consistency across steps.
  const context = resolveTree(scenario.context, {}, seed, faker);

  const startedAt = new Date().toISOString();
  const results: StepResult[] = [];
  yield { type: "scenario:start", scenario: scenario.name, seed };

  for (let i = 0; i < scenario.steps.length; i++) {
    const step = scenario.steps[i]!;
    if (opts.signal?.aborted) break;
    if (step.delayMs) await sleep(step.delayMs);

    yield { type: "step:start", index: i, event: step.event };

    const base = provider.resolveTemplate(step.event, scenario.apiVersion);
    const withCtx = resolveTree(base, context, seed, faker);
    const payload = deepMerge(withCtx, resolveTree(step.patch, context, seed, faker));

    // Serialize EXACTLY ONCE — the signature must cover the literal bytes sent.
    const body = JSON.stringify(payload);
    const headers = {
      "Content-Type": provider.contentType,
      ...provider.signer.sign({ body, secret }),
    };
    yield { type: "step:sent", index: i, event: step.event, headers };

    const t0 = Date.now();
    let result: StepResult;
    try {
      const res = await doFetch(scenario.target, { method: "POST", headers, body });
      const text = await res.text();
      const expect = step.expect;
      // Default expectation: a 2xx response. A handler that 4xx/5xx's on a valid
      // signed event is a failure unless the scenario explicitly asserts that status.
      const statusOk =
        expect?.status != null
          ? res.status === expect.status
          : res.status >= 200 && res.status < 300;
      const bodyOk = !expect?.bodyMatches || new RegExp(expect.bodyMatches).test(text);
      const reasons: string[] = [];
      if (!statusOk) {
        reasons.push(
          expect?.status != null
            ? `expected status ${expect.status}, got ${res.status}`
            : `expected 2xx, got ${res.status}`,
        );
      }
      if (!bodyOk) reasons.push(`body did not match /${expect?.bodyMatches}/`);
      result = {
        index: i,
        event: step.event,
        status: res.status,
        latencyMs: Date.now() - t0,
        passed: statusOk && bodyOk,
        error: reasons.length ? reasons.join("; ") : undefined,
      };
    } catch (err) {
      result = {
        index: i,
        event: step.event,
        latencyMs: Date.now() - t0,
        passed: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
    results.push(result);
    yield { type: "step:result", result };
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
