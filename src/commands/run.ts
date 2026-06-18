import { Command } from "commander";
import { run as runScenario, Scenario } from "../core/index.js";
import { loadScenario } from "../load.js";
import { resolveSecret } from "../secret.js";
import { renderLive } from "../render/live.js";
import { renderCi } from "../render/ci.js";

export const runCommand = new Command("run")
  .description("Run a scenario sequence against its target endpoint")
  .argument("<scenario>", "path to a scenario file or a built-in scenario name")
  .option("--target <url>", "override the scenario's target endpoint (full URL incl. host, port, path)")
  .option("--secret-env <name>", "env var holding the signing secret (overrides the scenario's secret.env)")
  .option("--ci", "machine output (JSON) + non-zero exit on failure", false)
  .option("--seed <n>", "override the deterministic faker seed", (v) => parseInt(v, 10))
  .action(
    async (
      path: string,
      opts: { target?: string; secretEnv?: string; ci?: boolean; seed?: number },
    ) => {
      const base = Scenario.parse(await loadScenario(path));
      const scenario = {
        ...base,
        ...(opts.seed != null ? { seed: opts.seed } : {}),
        ...(opts.target ? { target: opts.target } : {}),
        ...(opts.secretEnv ? { secret: { env: opts.secretEnv } } : {}),
      };
      const events = runScenario(scenario, { resolveSecret });
      const ok = opts.ci ? await renderCi(events) : await renderLive(events);
      if (!ok) process.exitCode = 1;
    },
  );
