import { describe, it, expect, vi } from "vitest";
import { run } from "./runner.js";
import { Scenario } from "./schema.js";
import type { ScenarioRun } from "./events.js";

function scenario(step: Record<string, unknown>) {
  return Scenario.parse({
    name: "t",
    provider: "stripe",
    apiVersion: "2024-06-20",
    target: "http://localhost:9999/webhook",
    secret: { value: "whsec_test" },
    steps: [{ event: "customer.subscription.created", ...step }],
  });
}

async function runWith(step: Record<string, unknown>, res: Response): Promise<ScenarioRun> {
  const events = run(scenario(step), {
    resolveSecret: () => "whsec_test",
    fetch: vi.fn(async () => res) as unknown as typeof fetch,
    sleep: async () => {},
  });
  let out: ScenarioRun | undefined;
  for await (const e of events) if (e.type === "scenario:done") out = e.run;
  return out!;
}

describe("runner status expectations", () => {
  it("passes a 200 with no explicit expectation", async () => {
    const r = await runWith({}, new Response("ok", { status: 200 }));
    expect(r.passed).toBe(true);
  });

  it("FAILS a 500 by default (no expect block)", async () => {
    const r = await runWith({}, new Response("err", { status: 500 }));
    expect(r.passed).toBe(false);
    expect(r.steps[0]!.error).toContain("expected 2xx, got 500");
  });

  it("FAILS a 400 by default", async () => {
    const r = await runWith({}, new Response("bad", { status: 400 }));
    expect(r.passed).toBe(false);
  });

  it("passes a 400 when the scenario explicitly expects it", async () => {
    const r = await runWith({ expect: { status: 400 } }, new Response("bad", { status: 400 }));
    expect(r.passed).toBe(true);
  });

  it("fails when an explicitly expected status is not met", async () => {
    const r = await runWith({ expect: { status: 200 } }, new Response("teapot", { status: 418 }));
    expect(r.passed).toBe(false);
    expect(r.steps[0]!.error).toContain("expected status 200, got 418");
  });

  it("checks bodyMatches alongside the default 2xx", async () => {
    const r = await runWith({ expect: { bodyMatches: "received" } }, new Response("not-it", { status: 200 }));
    expect(r.passed).toBe(false);
  });
});
