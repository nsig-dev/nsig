import { Command } from "commander";
import pc from "picocolors";
import { listScenarios } from "../load.js";

export const listCommand = new Command("list")
  .description("List built-in and local scenarios")
  .action(async () => {
    const scenarios = await listScenarios();
    if (!scenarios.length) return console.log(pc.dim("No scenarios found in ./scenarios"));
    for (const s of scenarios) console.log(`  ${pc.cyan(s.name)} ${pc.dim(s.path)}`);
  });
