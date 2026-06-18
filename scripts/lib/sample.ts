/**
 * Deterministic, depth-bounded JSON-Schema sampler. Resolves internal $refs
 * against the spec's components.schemas but caps recursion so Stripe's circular
 * references (customer → subscription → customer …) can't blow up.
 */
export interface SampleCtx {
  schemas: Record<string, any>;
  maxDepth: number;
}

export function sampleSchema(schema: any, ctx: SampleCtx, depth = 0): unknown {
  if (!schema || typeof schema !== "object") return null;

  if (typeof schema.$ref === "string") {
    if (depth >= ctx.maxDepth) return null;
    const name = schema.$ref.split("/").pop()!;
    return sampleSchema(ctx.schemas[name], ctx, depth + 1);
  }
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  if (schema.example !== undefined) return schema.example;
  if (schema.format === "unix-time") return 1700000000;
  if (Array.isArray(schema.anyOf) && schema.anyOf.length) return sampleSchema(schema.anyOf[0], ctx, depth);
  if (Array.isArray(schema.oneOf) && schema.oneOf.length) return sampleSchema(schema.oneOf[0], ctx, depth);
  if (Array.isArray(schema.allOf)) {
    return Object.assign({}, ...schema.allOf.map((s: any) => sampleSchema(s, ctx, depth) ?? {}));
  }

  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  switch (type) {
    case "object": {
      if (depth >= ctx.maxDepth) return {};
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(schema.properties ?? {})) {
        out[k] = sampleSchema(v, ctx, depth + 1);
      }
      return out;
    }
    case "array":
      return depth >= ctx.maxDepth ? [] : [sampleSchema(schema.items ?? {}, ctx, depth + 1)];
    case "string":
      return schema.title ?? "string";
    case "integer":
    case "number":
      return 0;
    case "boolean":
      return false;
    default:
      return null;
  }
}
