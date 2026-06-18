import { Command } from "commander";
import { run as runScenario, Scenario } from "../core/index.js";
import { getProvider } from "../providers/index.js";
import { listEvents } from "../schemas/index.js";
import { resolveSecret } from "../secret.js";
import { renderLive } from "../render/live.js";

export const fireCommand = new Command("fire")
  .description("Fire a single signed event — or the whole catalog with --all — at an endpoint")
  .argument("<provider>", "e.g. stripe")
  .argument("[event]", "e.g. invoice.payment_failed (omit when using --all)")
  .requiredOption("--to <url>", "target endpoint")
  .option("--all", "fire every event in the provider's generated catalog", false)
  .option("--secret-env <name>", "env var holding the signing secret", "STRIPE_WEBHOOK_SECRET")
  .option("--delay <ms>", "delay between events (with --all)", (v) => parseInt(v, 10), 0)
  .action(
    async (
      provider: string,
      event: string | undefined,
      opts: { to: string; all?: boolean; secretEnv: string; delay: number },
    ) => {
      const def = getProvider(provider); // validates the provider name
      const apiVersion = def.apiVersions[0] ?? "latest";

      let events: string[];
      if (opts.all) {
        events = listEvents(provider, apiVersion);
        if (!events.length) {
          console.error(`No catalog for "${provider}" @ ${apiVersion}. Run \`yarn generate\` first.`);
          process.exit(1);
        }
      } else if (event) {
        events = [event];
      } else {
        console.error("Provide an <event> argument, or use --all.");
        process.exit(1);
        return;
      }

      const scenario = Scenario.parse({
        name: opts.all ? `fire-all:${provider}` : `fire:${provider}:${event}`,
        provider,
        apiVersion,
        target: opts.to,
        secret: { env: opts.secretEnv },
        steps: events.map((e) => ({ event: e, delayMs: opts.delay })),
      });

      const ok = await renderLive(runScenario(scenario, { resolveSecret }));
      if (!ok) process.exitCode = 1;
    },
  );
