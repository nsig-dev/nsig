import { githubSigner } from "../../signing/index.js";
import { getTemplate } from "../../schemas/index.js";
import type { ProviderDef } from "../types.js";

export const github: ProviderDef = {
  id: "github",
  signer: githubSigner,
  contentType: "application/json",
  apiVersions: ["latest"],
  events: {
    // Templates to be generated from @octokit/webhooks-schemas (Phase 1.5).
    "pull_request": { schemaRef: "pull_request" },
    "push": { schemaRef: "push" },
    "issues": { schemaRef: "issues" },
  },
  resolveTemplate(event, apiVersion = "latest") {
    const tpl = getTemplate("github", event, apiVersion);
    if (!tpl) throw new Error(`No github template for ${event}@${apiVersion} (generate first)`);
    return tpl;
  },
};
