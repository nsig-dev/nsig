import { describe, it, expect } from "vitest";
import { stripeSigner } from "./schemes/stripe.js";

/**
 * Golden test (§13). The expected value is computed by Stripe's documented
 * algorithm: HMAC-SHA256(key = signing secret, msg = `${t}.${body}`), hex.
 * https://docs.stripe.com/webhooks/signatures
 */
describe("stripe signer (golden)", () => {
  it("matches the documented t.payload HMAC scheme", () => {
    const headers = stripeSigner.sign({
      body: '{"id":"evt_test"}',
      secret: "whsec_test_secret",
      timestamp: 1700000000,
    });
    expect(headers["Stripe-Signature"]).toBe(
      "t=1700000000,v1=13941114bb88ac44a76abcfddea5b92aa6182a4b63d8be3aae908a616083bd7e",
    );
  });
});
