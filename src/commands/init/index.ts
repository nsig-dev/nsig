import { Command } from "commander";
import * as p from "@clack/prompts";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseEnv } from "dotenv";
import {
  SUPPORTED_PROVIDERS,
  type SupportedProvider,
  detectProviders,
  detectSecretEnvVar,
  defaultSecretEnv,
  defaultTarget,
  scenarioTemplate,
  isSupported,
} from "./detect.js";

interface InitOpts {
  provider?: string;
  secretEnv?: string;
  target?: string;
  name?: string;
  yes?: boolean;
}

async function readJson(path: string): Promise<any | null> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

async function readEnvKeys(path: string): Promise<string[]> {
  try {
    return Object.keys(parseEnv(await readFile(path, "utf8")));
  } catch {
    return [];
  }
}

function bailIfCancelled<T>(v: T | symbol): T {
  if (p.isCancel(v)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }
  return v as T;
}

/** Read nsig's own version (relative to the installed CLI) for the dep range. */
async function nsigVersion(): Promise<string> {
  try {
    const url = new URL("../package.json", import.meta.url);
    const { version } = JSON.parse(await readFile(url, "utf8")) as { version?: string };
    return version ?? "latest";
  } catch {
    return "latest";
  }
}

/**
 * Scenarios `import { defineScenario } from "nsig"`, so nsig must resolve from the
 * project. Add it to devDependencies if it isn't already declared.
 */
async function ensureNsigDep(
  cwd: string,
  pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | null,
): Promise<"present" | "added" | "no-pkg"> {
  if (pkg && (pkg.dependencies?.nsig || pkg.devDependencies?.nsig)) return "present";
  if (!pkg) return "no-pkg";
  const version = await nsigVersion();
  pkg.devDependencies = {
    ...(pkg.devDependencies ?? {}),
    nsig: version === "latest" ? "latest" : `^${version}`,
  };
  await writeFile(resolve(cwd, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
  return "added";
}

export const initCommand = new Command("init")
  .description("Detect your provider + webhook secret and scaffold a starter scenario")
  .option("--provider <id>", "stripe | github")
  .option("--secret-env <name>", "env var holding the signing secret")
  .option("--target <url>", "target endpoint URL")
  .option("--name <name>", "scenario name")
  .option("-y, --yes", "non-interactive: accept detected values and defaults", false)
  .action(async (opts: InitOpts) => {
    p.intro("nsig init");
    const cwd = process.cwd();
    const pkg = await readJson(resolve(cwd, "package.json"));
    const envKeys = await readEnvKeys(resolve(cwd, ".env"));

    const detected = detectProviders(pkg).filter(isSupported);
    if (detected.length) p.log.info(`Detected: ${detected.join(", ")}`);

    // --- provider ---
    let provider: SupportedProvider;
    if (opts.provider) {
      if (!isSupported(opts.provider)) {
        p.cancel(`Unsupported provider "${opts.provider}". Supported: ${SUPPORTED_PROVIDERS.join(", ")}`);
        process.exit(1);
      }
      provider = opts.provider;
    } else if (opts.yes) {
      provider = detected[0] ?? "stripe";
    } else {
      provider = bailIfCancelled(
        await p.select({
          message: "Which provider?",
          initialValue: detected[0] ?? "stripe",
          options: SUPPORTED_PROVIDERS.map((v) => ({ value: v, label: v })),
        }),
      );
    }

    // --- secret env var (auto-detected from .env) ---
    const guessSecret =
      opts.secretEnv ?? detectSecretEnvVar(envKeys, provider) ?? defaultSecretEnv(provider);
    let secretEnv = guessSecret;
    if (!opts.secretEnv && !opts.yes) {
      secretEnv = bailIfCancelled(
        await p.text({
          message: "Env var holding the signing secret",
          initialValue: guessSecret,
        }),
      );
    }
    if (envKeys.length && !envKeys.includes(secretEnv)) {
      p.log.warn(`${secretEnv} isn't in .env yet — add it (any value works locally, but your app must verify with the same one).`);
    }

    // --- target ---
    const guessTarget = opts.target ?? defaultTarget(provider);
    let target = guessTarget;
    if (!opts.target && !opts.yes) {
      target = bailIfCancelled(
        await p.text({ message: "Target endpoint URL", initialValue: guessTarget }),
      );
    }

    // --- name ---
    const guessName = opts.name ?? `${provider}-starter`;
    let name = guessName;
    if (!opts.name && !opts.yes) {
      name = bailIfCancelled(await p.text({ message: "Scenario name", initialValue: guessName }));
    }

    // --- write ---
    const dir = resolve(cwd, "scenarios");
    const file = resolve(dir, `${name}.ts`);
    if (existsSync(file) && !opts.yes) {
      const ok = bailIfCancelled(
        await p.confirm({ message: `scenarios/${name}.ts exists. Overwrite?`, initialValue: false }),
      );
      if (!ok) {
        p.outro("Left existing file untouched.");
        return;
      }
    }
    await mkdir(dir, { recursive: true });
    await writeFile(file, scenarioTemplate({ provider, name, secretEnv, target }));

    // Scenarios import "nsig", so make sure the project can resolve it.
    const dep = await ensureNsigDep(cwd, pkg);

    p.note(
      `provider  ${provider}\nsecret    ${secretEnv}\ntarget    ${target}`,
      `created scenarios/${name}.ts`,
    );
    if (dep === "added") {
      p.log.info("Added nsig to devDependencies — run `npm install` (or `npm link nsig` for local dev).");
    } else if (dep === "no-pkg") {
      p.log.info("No package.json found — install nsig here: `npm i -D nsig`.");
    }
    p.outro(`Run it:  npx nsig run scenarios/${name}.ts`);
  });
