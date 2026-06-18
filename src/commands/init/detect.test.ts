import { describe, it, expect } from "vitest";
import {
  detectProviders,
  detectSecretEnvVar,
  scoreSecretKey,
  scenarioTemplate,
  defaultSecretEnv,
  defaultTarget,
} from "./detect.js";

describe("detectSecretEnvVar — name variations", () => {
  it.each([
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_WEBHOOK",
    "WH_SECRET_STRIPE",
    "STRIPE_WH_SECRET",
    "STRIPE_WEBHOOK_SIGNING_SECRET",
  ])("picks %s when it is the only stripe var", (key) => {
    expect(detectSecretEnvVar([key], "stripe")).toBe(key);
  });

  it("picks the webhook secret out of a noisy .env, not the API key", () => {
    expect(
      detectSecretEnvVar(
        ["DATABASE_URL", "STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET", "PORT"],
        "stripe",
      ),
    ).toBe("STRIPE_WEBHOOK_SECRET");
  });

  it("never selects an API or publishable key on its own", () => {
    expect(detectSecretEnvVar(["STRIPE_SECRET_KEY"], "stripe")).toBeUndefined();
    expect(detectSecretEnvVar(["STRIPE_PUBLISHABLE_KEY"], "stripe")).toBeUndefined();
    expect(scoreSecretKey("STRIPE_SECRET_KEY", "stripe")).toBe(0);
  });

  it("ranks webhook > wh > plain webhook", () => {
    expect(
      detectSecretEnvVar(["STRIPE_WEBHOOK", "STRIPE_WH_SECRET", "STRIPE_WEBHOOK_SECRET"], "stripe"),
    ).toBe("STRIPE_WEBHOOK_SECRET");
  });

  it("returns undefined when nothing matches", () => {
    expect(detectSecretEnvVar(["DATABASE_URL", "PORT"], "stripe")).toBeUndefined();
  });
});

describe("detectSecretEnvVar — github incl. gh alias", () => {
  it("matches GITHUB_ and GH_ prefixes", () => {
    expect(detectSecretEnvVar(["GITHUB_WEBHOOK_SECRET"], "github")).toBe("GITHUB_WEBHOOK_SECRET");
    expect(detectSecretEnvVar(["GH_WEBHOOK_SECRET"], "github")).toBe("GH_WEBHOOK_SECRET");
  });

  it("does not cross providers or trip on 'gh' substrings", () => {
    expect(detectSecretEnvVar(["STRIPE_WEBHOOK_SECRET"], "github")).toBeUndefined();
    expect(scoreSecretKey("HIGHLIGHT_WEBHOOK_SECRET", "github")).toBe(0);
  });
});

describe("detectProviders", () => {
  it("reads providers from deps + devDeps", () => {
    expect(detectProviders({ dependencies: { stripe: "^17", express: "^4" } })).toContain("stripe");
    expect(detectProviders({ dependencies: { "@octokit/webhooks": "^13" } })).toContain("github");
    expect(detectProviders({ devDependencies: { svix: "^1" } })).toContain("clerk");
    expect(detectProviders(null)).toEqual([]);
  });
});

describe("scenarioTemplate", () => {
  it("emits valid-looking stripe scenario with the chosen secret + target", () => {
    const src = scenarioTemplate({
      provider: "stripe",
      name: "my-dunning",
      secretEnv: "STRIPE_WH_SECRET",
      target: "http://localhost:8080/hooks/stripe",
    });
    expect(src).toContain('provider: "stripe"');
    expect(src).toContain('secret: { env: "STRIPE_WH_SECRET" }');
    expect(src).toContain("http://localhost:8080/hooks/stripe");
    expect(src).toContain('import { defineScenario, ref } from "nsig"');
  });

  it("emits a github scenario when provider is github", () => {
    const src = scenarioTemplate({
      provider: "github",
      name: "pr",
      secretEnv: "GH_WEBHOOK_SECRET",
      target: defaultTarget("github"),
    });
    expect(src).toContain('provider: "github"');
    expect(src).toContain('"pull_request"');
  });
});

describe("defaults", () => {
  it("derives sensible default names", () => {
    expect(defaultSecretEnv("stripe")).toBe("STRIPE_WEBHOOK_SECRET");
    expect(defaultTarget("github")).toBe("http://localhost:3000/api/v1/webhooks/github");
  });
});
