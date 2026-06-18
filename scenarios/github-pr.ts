import { defineScenario } from "nsig";

/** GitHub PR lifecycle: opened → synchronized → merged, all signed. */
export default defineScenario({
  name: "github-pr-lifecycle",
  provider: "github",
  target: "http://localhost:3000/api/v1/webhooks/github",
  secret: { env: "GITHUB_WEBHOOK_SECRET" },
  steps: [
    { event: "pull_request", patch: { action: "opened" }, expect: { status: 200 } },
    { event: "pull_request", delayMs: 500, patch: { action: "synchronize" } },
    {
      event: "pull_request",
      delayMs: 500,
      patch: { action: "closed", pull_request: { merged: true } },
      expect: { status: 200 },
    },
  ],
});
