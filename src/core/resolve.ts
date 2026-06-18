import { faker as baseFaker, Faker, en } from "@faker-js/faker";
import { isRef } from "./define.js";

/** Deterministic faker seeded per-run so payloads are reproducible. */
export function seededFaker(seed: number): Faker {
  const f = new Faker({ locale: [en] });
  f.seed(seed);
  return f;
}

/** Stable numeric seed from a string (used when no explicit seed is given). */
export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Resolve `{{...}}` interpolations in strings:
 *   {{seed}}        -> the run seed
 *   {{faker.email}} -> seeded faker value (faker.<namespace>.<method> dotted path)
 */
export function interpolate(value: string, seed: number, faker: Faker): string {
  return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, expr: string) => {
    if (expr === "seed") return String(seed);
    if (expr.startsWith("faker.")) {
      const path = expr.slice("faker.".length).split(".");
      // walk faker by dotted path, e.g. internet.email
      let node: any = faker;
      for (const key of path) node = node?.[key];
      return typeof node === "function" ? String(node.call(faker)) : String(node ?? "");
    }
    return _m;
  });
}

/** Recursively resolve refs + interpolations over an arbitrary structure. */
export function resolveTree(node: any, ctx: any, seed: number, faker: Faker): any {
  if (typeof node === "string") return interpolate(node, seed, faker);
  if (isRef(node)) return getPath(ctx, node.__ref);
  if (Array.isArray(node)) return node.map((n) => resolveTree(n, ctx, seed, faker));
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = resolveTree(v, ctx, seed, faker);
    return out;
  }
  return node;
}

function getPath(obj: any, path: string): unknown {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

/** Deep-merge `patch` onto `base` (patch wins; objects merged, arrays replaced). */
export function deepMerge<T>(base: T, patch?: Record<string, unknown>): T {
  if (!patch) return base;
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...(base as any) };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object") {
      out[k] = deepMerge(out[k], v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export { baseFaker };
