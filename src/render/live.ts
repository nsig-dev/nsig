import pc from "picocolors";
import type { RunnerEvent } from "../core/index.js";

/** Human, TTY renderer. Subscribes to the runner's event stream (§5). */
export async function renderLive(events: AsyncIterable<RunnerEvent>): Promise<boolean> {
  let ok = true;
  for await (const ev of events) {
    switch (ev.type) {
      case "scenario:start":
        console.log(pc.bold(`\n▶ ${ev.scenario}`) + pc.dim(` (seed ${ev.seed})`));
        break;
      case "step:start":
        process.stdout.write(pc.dim(`  ${ev.index + 1}. ${ev.event} … `));
        break;
      case "step:result": {
        const r = ev.result;
        if (!r.passed) ok = false;
        const mark = r.passed ? pc.green("✓") : pc.red("✗");
        const status = r.status ? pc.dim(`${r.status} `) : "";
        console.log(`${mark} ${status}${pc.dim(`${r.latencyMs}ms`)}${r.error ? pc.red(` ${r.error}`) : ""}`);
        break;
      }
      case "scenario:done":
        console.log(ev.run.passed ? pc.green("\n✓ passed") : pc.red("\n✗ failed"));
        break;
    }
  }
  return ok;
}
