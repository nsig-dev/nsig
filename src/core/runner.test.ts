import { describe, it, expect } from "vitest";
import { run } from "./runner.js";
import { Scenario } from "./schema.js";
import { seededOrder } from "./resolve.js";
import type { ScenarioRun } from "./events.js";

function scn(steps: Record<string, unknown>[], extra: Record<string, unknown> = {}) {
  return Scenario.parse({
    name: "t",
    provider: "stripe",
    apiVersion: "2024-06-20",
    target: "http://localhost:9999/h",
    secret: { value: "whsec" },
    steps,
    ...extra,
  });
}

function recorder(handler: (call: number) => Response) {
  const calls: { body: string; headers: Record<string, string> }[] = [];
  let n = 0;
  const fetchFn = (async (_url: unknown, init: any) => {
    calls.push({ body: init.body, headers: init.headers });
    return handler(n++);
  }) as unknown as typeof fetch;
  return { calls, fetchFn };
}

async function collect(scenario: ReturnType<typeof scn>, opts: any): Promise<ScenarioRun> {
  let out: ScenarioRun | undefined;
  for await (const e of run(scenario, { resolveSecret: () => "whsec", sleep: async () => {}, ...opts }))
    if (e.type === "scenario:done") out = e.run;
  return out!;
}

const ok = () => new Response("ok", { status: 200 });

describe("status expectations", () => {
  it("passes 2xx, fails non-2xx by default", async () => {
    expect((await collect(scn([{ event: "customer.subscription.created" }]), { fetch: recorder(ok).fetchFn })).passed).toBe(true);
    const bad = await collect(scn([{ event: "customer.subscription.created" }]), {
      fetch: recorder(() => new Response("x", { status: 500 })).fetchFn,
    });
    expect(bad.passed).toBe(false);
    expect(bad.steps[0]!.error).toContain("expected 2xx, got 500");
  });

  it("honors an explicit non-2xx expectation", async () => {
    const r = await collect(scn([{ event: "customer.subscription.created", expect: { status: 400 } }]), {
      fetch: recorder(() => new Response("bad", { status: 400 })).fetchFn,
    });
    expect(r.passed).toBe(true);
  });
});

describe("repeat (duplicate / idempotency)", () => {
  it("sends N byte-identical deliveries", async () => {
    const rec = recorder(ok);
    const r = await collect(scn([{ event: "customer.subscription.created", repeat: 3 }]), { fetch: rec.fetchFn });
    expect(rec.calls).toHaveLength(3);
    expect(rec.calls[0]!.body).toBe(rec.calls[1]!.body);
    expect(rec.calls[1]!.body).toBe(rec.calls[2]!.body);
    expect(r.steps).toHaveLength(3);
    expect(r.steps[0]!.attempt).toBe("dup 1/3");
    expect(r.passed).toBe(true);
  });
});

describe("id pinning", () => {
  it("forces the event id (for redelivery)", async () => {
    const rec = recorder(ok);
    await collect(scn([{ event: "customer.subscription.created", id: "evt_fixed_1" }]), { fetch: rec.fetchFn });
    expect(JSON.parse(rec.calls[0]!.body).id).toBe("evt_fixed_1");
  });

  it("duplicate delivery reuses the same pinned id", async () => {
    const rec = recorder(ok);
    await collect(scn([{ event: "customer.subscription.created", id: "evt_dup", repeat: 2 }]), { fetch: rec.fetchFn });
    expect(JSON.parse(rec.calls[0]!.body).id).toBe("evt_dup");
    expect(JSON.parse(rec.calls[1]!.body).id).toBe("evt_dup");
  });
});

describe("retry on failure", () => {
  it("recovers when a later attempt succeeds (collapsed to one passing result)", async () => {
    const rec = recorder((c) => new Response("", { status: c === 0 ? 500 : 200 }));
    const r = await collect(scn([{ event: "customer.subscription.created", retry: { times: 3 } }]), { fetch: rec.fetchFn });
    expect(rec.calls).toHaveLength(2); // 1 fail + 1 success
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0]!.passed).toBe(true);
    expect(r.steps[0]!.attempt).toBe("after 1 retry");
    expect(r.passed).toBe(true);
  });

  it("fails after exhausting retries", async () => {
    const rec = recorder(() => new Response("", { status: 500 }));
    const r = await collect(scn([{ event: "customer.subscription.created", retry: { times: 2 } }]), { fetch: rec.fetchFn });
    expect(rec.calls).toHaveLength(3); // initial + 2 retries
    expect(r.passed).toBe(false);
  });
});

describe("shuffle (out-of-order delivery)", () => {
  const events = ["customer.subscription.created", "invoice.payment_failed", "customer.subscription.deleted"];

  it("delivers in seeded order, reproducibly", async () => {
    const steps = events.map((event) => ({ event }));
    const r = await collect(scn(steps, { seed: 42 }), { fetch: recorder(ok).fetchFn, shuffle: true });
    const order = r.steps.map((s) => s.index);
    expect([...order].sort()).toEqual([0, 1, 2]); // a permutation
    expect(order).toEqual(seededOrder(3, 42)); // matches the seeded util
  });

  it("is in declaration order without --shuffle", async () => {
    const steps = events.map((event) => ({ event }));
    const r = await collect(scn(steps, { seed: 42 }), { fetch: recorder(ok).fetchFn });
    expect(r.steps.map((s) => s.index)).toEqual([0, 1, 2]);
  });
});
