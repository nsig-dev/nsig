import pc from "picocolors";
import type { RunnerEvent } from "../core/index.js";

/** Human, TTY renderer. One line per delivery (so repeats/retries read clearly). */
export async function renderLive(events: AsyncIterable<RunnerEvent>): Promise<boolean> {
  let ok = true;
  for await (const ev of events) {
    switch (ev.type) {
      case "scenario:start":
        console.log(pc.bold(`\n▶ ${ev.scenario}`) + pc.dim(` (seed ${ev.seed})`));
        break;
      case "step:result": {
        const r = ev.result;
        if (!r.passed) ok = false;
        const mark = r.passed ? pc.green("✓") : pc.red("✗");
        const status = r.status ? `${r.status} ` : "";
        const attempt = r.attempt ? pc.yellow(` [${r.attempt}]`) : "";
        const err = r.error ? pc.red(` ${r.error}`) : "";
        console.log(`  ${mark} ${r.event}${attempt} ${pc.dim(`${status}${r.latencyMs}ms`)}${err}`);
        break;
      }
      case "scenario:done":
        console.log(ev.run.passed ? pc.green("✓ passed") : pc.red("✗ failed"));
        break;
    }
  }
  return ok;
}
