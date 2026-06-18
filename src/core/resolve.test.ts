import { describe, it, expect } from "vitest";
import { resolveTree, interpolate, seededFaker } from "./resolve.js";

const faker = seededFaker(1);
const tree = (node: unknown) => resolveTree(node, {}, 42, faker);

describe("interpolation tokens", () => {
  it("coerces a bare {{seed}} to a number, keeps embedded as string", () => {
    expect(tree("{{seed}}")).toBe(42);
    expect(tree("cus_{{seed}}")).toBe("cus_42");
  });

  it("{{now}} is current unix seconds (number)", () => {
    const now = Math.floor(Date.now() / 1000);
    const v = tree("{{now}}") as number;
    expect(typeof v).toBe("number");
    expect(Math.abs(v - now)).toBeLessThanOrEqual(2);
  });

  it("{{now±N<unit>}} offsets correctly", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(Math.abs((tree("{{now+14d}}") as number) - (now + 14 * 86400))).toBeLessThanOrEqual(2);
    expect(Math.abs((tree("{{now-2h}}") as number) - (now - 2 * 3600))).toBeLessThanOrEqual(2);
    expect(Math.abs((tree("{{now+30m}}") as number) - (now + 30 * 60))).toBeLessThanOrEqual(2);
  });

  it("resolves faker tokens to strings", () => {
    expect(tree("{{faker.internet.email}}")).toContain("@");
  });

  it("leaves unknown tokens untouched", () => {
    expect(tree("{{nope}}")).toBe("{{nope}}");
    expect(interpolate("a {{nope}} b", 1, faker)).toBe("a {{nope}} b");
  });

  it("resolves nested time fields to numbers in a payload", () => {
    const out = tree({ data: { object: { trial_end: "{{now+7d}}", status: "trialing" } } }) as any;
    expect(typeof out.data.object.trial_end).toBe("number");
    expect(out.data.object.status).toBe("trialing");
  });
});
