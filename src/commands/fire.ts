import { Command } from "commander";
import { run as runScenario, Scenario } from "../core/index.js";
import { resolveSecret } from "../secret.js";
import { renderLive } from "../render/live.js";

export const fireCommand = new Command("fire")
  .description("Fire a single signed event at an endpoint")
  .argument("<provider>", "e.g. stripe")
  .argument("<event>", "e.g. invoice.payment_failed")
  .requiredOption("--to <url>", "target endpoint")
  .option("--secret-env <name>", "env var holding the signing secret", "STRIPE_WEBHOOK_SECRET")
  .action(async (provider: string, event: string, opts: { to: string; secretEnv: string }) => {
    const scenario = Scenario.parse({
      name: `fire:${provider}:${event}`,
      provider,
      target: opts.to,
      secret: { env: opts.secretEnv },
      steps: [{ event }],
    });
    const ok = await renderLive(runScenario(scenario, { resolveSecret }));
    if (!ok) process.exitCode = 1;
  });
