import { Faker, en } from "@faker-js/faker";
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

const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 };

/**
 * Resolve a single `{{...}}` token to its value.
 *   {{seed}}        -> the run seed (number)
 *   {{now}}         -> current unix time in seconds (number)
 *   {{now+14d}}     -> now ± offset, units s|m|h|d|w (number) — for trial_end, period_end, …
 *   {{faker.x.y}}   -> seeded faker value (string)
 * Returns `undefined` for unknown tokens so they're left untouched.
 */
function resolveToken(expr: string, seed: number, faker: Faker): string | number | undefined {
  if (expr === "seed") return seed;
  if (expr === "now") return Math.floor(Date.now() / 1000);
  const t = expr.match(/^now([+-]\d+)([smhdw])$/);
  if (t) {
    return Math.floor(Date.now() / 1000) + parseInt(t[1]!, 10) * UNIT_SECONDS[t[2]!]!;
  }
  if (expr.startsWith("faker.")) {
    const path = expr.slice("faker.".length).split(".");
    let node: any = faker;
    for (const key of path) node = node?.[key];
    return typeof node === "function" ? String(node.call(faker)) : node == null ? "" : String(node);
  }
  return undefined;
}

/** Interpolate every `{{...}}` token inside a string (always yields a string). */
export function interpolate(value: string, seed: number, faker: Faker): string {
  return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, expr: string) => {
    const v = resolveToken(expr, seed, faker);
    return v === undefined ? _m : String(v);
  });
}

/** Recursively resolve refs + interpolations over an arbitrary structure. */
export function resolveTree(node: any, ctx: any, seed: number, faker: Faker): any {
  if (typeof node === "string") {
    // A value that is exactly one token keeps its native type (number for
    // seed/now/time), so timestamps land as numbers, not strings.
    const single = node.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
    if (single) {
      const v = resolveToken(single[1]!, seed, faker);
      if (v !== undefined) return v;
    }
    return interpolate(node, seed, faker);
  }
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


/** Small deterministic PRNG for reproducible shuffles. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded Fisher–Yates order of [0..n) — reproducible out-of-order delivery. */
export function seededOrder(n: number, seed: number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  const rnd = mulberry32(seed);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = idx[i]!;
    idx[i] = idx[j]!;
    idx[j] = tmp;
  }
  return idx;
}
