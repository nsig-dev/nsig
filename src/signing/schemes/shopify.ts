import { createHmac } from "node:crypto";
import type { Signer } from "../types.js";

/**
 * Shopify: `X-Shopify-Hmac-Sha256: <base64>`, HMAC-SHA256 over the raw body,
 * base64-encoded. https://shopify.dev/docs/apps/webhooks/configuration/https
 */
export const shopifySigner: Signer = {
  sign({ body, secret }) {
    const b64 = createHmac("sha256", secret).update(body, "utf8").digest("base64");
    return { "X-Shopify-Hmac-Sha256": b64 };
  },
};
