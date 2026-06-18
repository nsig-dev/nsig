/**
 * A Signer turns the EXACT serialized request body into the headers a provider
 * expects. The runner serializes the payload once and passes those literal
 * bytes here, because the signature must be computed over what is actually sent.
 */
export interface SignInput {
  /** The exact serialized body bytes that will be transmitted. */
  body: string;
  /** The signing secret (resolved from env/keychain by the caller). */
  secret: string;
  /** Unix seconds. Defaults to now when a scheme needs a timestamp. */
  timestamp?: number;
  /** Per-provider extras (e.g. Svix message id, Twilio request URL). */
  meta?: Record<string, string>;
}

export interface Signer {
  /** Returns the headers to attach to the outgoing request. */
  sign(input: SignInput): Record<string, string>;
}
