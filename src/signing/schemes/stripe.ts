import { createHmac } from "node:crypto";
import type { Signer } from "../types.js";

/**
 * Stripe: `Stripe-Signature: t=<ts>,v1=<hex>` where the signature is
 * HMAC-SHA256 over `"{t}.{body}"`, hex-encoded. Secret is the `whsec_...` value.
 * Verify against: https://docs.stripe.com/webhooks/signatures
 */
export const stripeSigner: Signer = {
  sign({ body, secret, timestamp }) {
    const t = timestamp ?? Math.floor(Date.now() / 1000);
    const signedPayload = `${t}.${body}`;
    const v1 = createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
    return { "Stripe-Signature": `t=${t},v1=${v1}` };
  },
};
