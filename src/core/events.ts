export interface StepResult {
  index: number;
  event: string;
  status?: number;
  latencyMs: number;
  passed: boolean;
  error?: string;
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
