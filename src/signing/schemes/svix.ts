import { createHmac } from "node:crypto";
import type { Signer } from "../types.js";

/**
 * Svix / Clerk: signs `"{id}.{ts}.{body}"` with HMAC-SHA256, base64-encoded,
 * emitted as `svix-signature: v1,<base64>`. The secret is base64 after the
 * `whsec_` prefix. https://docs.svix.com/receiving/verifying-payloads/how
 */
export const svixSigner: Signer = {
  sign({ body, secret, timestamp, meta }) {
    const ts = timestamp ?? Math.floor(Date.now() / 1000);
    const id = meta?.id ?? `msg_${ts}`;
    const key = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
    const keyBytes = Buffer.from(key, "base64");
    const toSign = `${id}.${ts}.${body}`;
    const sig = createHmac("sha256", keyBytes).update(toSign, "utf8").digest("base64");
    return {
      "svix-id": id,
      "svix-timestamp": String(ts),
      "svix-signature": `v1,${sig}`,
    };
  },
};
