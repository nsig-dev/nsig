import { describe, it, expect } from "vitest";
import { githubSigner } from "./schemes/github.js";

/**
 * Golden test (§13). Uses GitHub's OWN documented example: secret
 * "It's a Secret to Everybody", body "Hello, World!" → the published digest.
 * https://docs.github.com/webhooks/using-webhooks/validating-webhook-deliveries
 */
describe("github signer (golden)", () => {
  it("reproduces GitHub's documented example signature", () => {
    const headers = githubSigner.sign({
      body: "Hello, World!",
      secret: "It's a Secret to Everybody",
    });
    expect(headers["X-Hub-Signature-256"]).toBe(
      "sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17",
    );
  });
});
