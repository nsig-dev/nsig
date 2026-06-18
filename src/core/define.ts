import { Scenario as ScenarioSchema, type Scenario } from "./schema.js";

/** A reference to another value in the scenario context (referential integrity). */
export interface Ref {
  readonly __ref: string;
}
export function ref(path: string): Ref {
  return { __ref: path };
}
export function isRef(v: unknown): v is Ref {
  return typeof v === "object" && v !== null && "__ref" in v;
}

/** Authoring helper: validates and returns a typed scenario. */
export function defineScenario(input: Scenario): Scenario {
  return ScenarioSchema.parse(input);
}
