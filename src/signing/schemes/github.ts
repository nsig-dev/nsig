import { createHmac } from "node:crypto";
import type { Signer } from "../types.js";

/**
 * GitHub: `X-Hub-Signature-256: sha256=<hex>`, HMAC-SHA256 over the raw body.
 * https://docs.github.com/webhooks/using-webhooks/validating-webhook-deliveries
 */
export const githubSigner: Signer = {
  sign({ body, secret }) {
    const hex = createHmac("sha256", secret).update(body, "utf8").digest("hex");
    return { "X-Hub-Signature-256": `sha256=${hex}` };
  },
};
