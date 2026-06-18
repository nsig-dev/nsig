import { Command } from "commander";
import pc from "picocolors";
import { listScenarios } from "../load.js";
import { getProvider } from "../providers/index.js";
import { listEvents } from "../schemas/index.js";

export const listCommand = new Command("list")
  .description("List local scenarios, or a provider's event catalog with --events")
  .option("--events <provider>", "list every event nsig can fire for a provider")
  .action(async (opts: { events?: string }) => {
    if (opts.events) {
      const def = getProvider(opts.events);
      const apiVersion = def.apiVersions[0] ?? "latest";
      const events = listEvents(opts.events, apiVersion);
      if (!events.length) return console.log(pc.dim(`No catalog for ${opts.events} (run \`yarn generate\`).`));
      console.log(pc.bold(`${opts.events} @ ${apiVersion} — ${events.length} events`));
      for (const e of events.sort()) console.log(`  ${e}`);
      return;
    }
    const scenarios = await listScenarios();
    if (!scenarios.length) return console.log(pc.dim("No scenarios found in ./scenarios"));
    for (const s of scenarios) console.log(`  ${pc.cyan(s.name)} ${pc.dim(s.path)}`);
  });
