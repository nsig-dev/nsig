import { createHmac } from "node:crypto";
import type { Signer } from "../types.js";

/**
 * Twilio: `X-Twilio-Signature: <base64>`. HMAC-SHA1 over
 * `url + sorted(concat(key+value))` of the POST params, base64-encoded.
 * Secret is the account auth token. Twilio webhooks are form-encoded, not JSON,
 * so the provider def must pass the URL and the param map via `meta`/`body`.
 * https://www.twilio.com/docs/usage/security#validating-requests
 */
export const twilioSigner: Signer = {
  sign({ body, secret, meta }) {
    // `body` here is the request URL; `meta` holds the form params.
    const url = body;
    const params = meta ?? {};
    const data =
      url +
      Object.keys(params)
        .sort()
        .map((k) => k + params[k])
        .join("");
    const sig = createHmac("sha1", secret).update(data, "utf8").digest("base64");
    return { "X-Twilio-Signature": sig };
  },
};
