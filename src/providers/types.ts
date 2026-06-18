import type { Signer } from "../signing/index.js";

export type ProviderId = "stripe" | "github" | "shopify" | "clerk" | "twilio";

export interface EventDef {
  /** Key into the schemas registry, e.g. "customer.subscription.created". */
  schemaRef: string;
  /** Applied beneath any per-step patch (provider-level defaults). */
  defaultPatch?: Record<string, unknown>;
}

export interface ProviderDef {
  id: ProviderId;
  signer: Signer;
  contentType: "application/json" | "application/x-www-form-urlencoded";
  events: Record<string, EventDef>;
  apiVersions: string[];
  /** Resolve the base template for an event at a given apiVersion. */
  resolveTemplate(event: string, apiVersion?: string): object;
}
