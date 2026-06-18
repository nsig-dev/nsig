import type { Scenario } from "./core/index.js";

/**
 * Resolve a scenario secret. Secrets come from env (or, later, the OS keychain)
 * and are NEVER written to scenario files or logs. The inline `value` form is
 * for ephemeral CI use only.
 */
export function resolveSecret(secret: Scenario["secret"]): string {
  if ("value" in secret) return secret.value;
  const v = process.env[secret.env];
  if (!v)
    throw new Error(
      `Missing secret: ${secret.env} is not set. Add it to your .env (the same value ` +
        `your app verifies with), or pass --env-file <path>.`,
    );
  return v;
}
