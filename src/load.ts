import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SCENARIO_DIR = resolve(process.cwd(), "scenarios");

/**
 * Load a scenario from a .ts/.js (default export) file, or by bare name from
 * ./scenarios. TypeScript scenarios are transpiled on import via tsx so authors
 * get full type-safety without a build step.
 */
export async function loadScenario(pathOrName: string): Promise<unknown> {
  const candidate =
    pathOrName.includes("/") || pathOrName.includes(".")
      ? resolve(process.cwd(), pathOrName)
      : resolve(SCENARIO_DIR, `${pathOrName}.ts`);

  if (candidate.endsWith(".ts") || candidate.endsWith(".mts")) {
    const { tsImport } = await import("tsx/esm/api");
    const mod = await tsImport(candidate, import.meta.url);
    return mod.default ?? mod;
  }
  if (candidate.endsWith(".js") || candidate.endsWith(".mjs")) {
    const mod = await import(pathToFileURL(candidate).href);
    return mod.default ?? mod;
  }
  // TODO: YAML/JSON loader (the visual builder format) — parse + same Zod schema.
  throw new Error(`Unsupported scenario format: ${candidate}`);
}

export async function listScenarios(): Promise<{ name: string; path: string }[]> {
  try {
    const files = await readdir(SCENARIO_DIR);
    return files
      .filter((f) => /\.(ts|js|ya?ml|json)$/.test(f))
      .map((f) => ({ name: f.replace(/\.[^.]+$/, ""), path: `scenarios/${f}` }));
  } catch {
    return [];
  }
}
