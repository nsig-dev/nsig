import { z } from "zod";

export const Step = z.object({
  event: z.string(),
  /** Pin the event id — for redelivery / idempotency testing. */
  id: z.string().optional(),
  patch: z.record(z.any()).optional(),
  delayMs: z.number().int().nonnegative().default(0),
  /** Send this step N times with the SAME id+body (idempotency / duplicate delivery). */
  repeat: z.number().int().min(1).default(1),
  /** Resend on failure, mimicking provider redelivery. */
  retry: z
    .object({
      times: z.number().int().min(1),
      onlyIf: z.enum(["non-2xx", "always"]).default("non-2xx"),
    })
    .optional(),
  expect: z
    .object({
      status: z.number().optional(),
      bodyMatches: z.string().optional(),
      timeoutMs: z.number().default(5000),
    })
    .optional(),
});

export const Scenario = z.object({
  name: z.string(),
  provider: z.string(),
  apiVersion: z.string().optional(),
  target: z.string().url(),
  secret: z.union([z.object({ env: z.string() }), z.object({ value: z.string() })]),
  context: z.record(z.any()).default({}),
  steps: z.array(Step).min(1),
  seed: z.number().int().optional(),
});

export type Step = z.infer<typeof Step>;
export type Scenario = z.infer<typeof Scenario>;
