export interface StepResult {
  index: number;
  event: string;
  status?: number;
  latencyMs: number;
  passed: boolean;
  error?: string;
  /** Set for duplicates/retries, e.g. "dup 2/2" or "after 1 retry". */
  attempt?: string;
}

export interface ScenarioRun {
  scenario: string;
  startedAt: string;
  finishedAt: string;
  passed: boolean;
  steps: StepResult[];
}

export type RunnerEvent =
  | { type: "scenario:start"; scenario: string; seed: number }
  | { type: "step:start"; index: number; event: string }
  | { type: "step:sent"; index: number; event: string; headers: Record<string, string> }
  | { type: "step:result"; result: StepResult }
  | { type: "scenario:done"; run: ScenarioRun };
