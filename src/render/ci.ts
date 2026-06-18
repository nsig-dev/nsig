import type { RunnerEvent, ScenarioRun } from "../core/index.js";

/** Non-TTY renderer: emits the ScenarioRun as JSON to stdout (§12). */
export async function renderCi(events: AsyncIterable<RunnerEvent>): Promise<boolean> {
  let run: ScenarioRun | undefined;
  for await (const ev of events) if (ev.type === "scenario:done") run = ev.run;
  process.stdout.write(JSON.stringify(run, null, 2) + "\n");
  return run?.passed ?? false;
}
