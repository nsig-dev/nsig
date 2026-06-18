import { stripeSigner } from "../../signing/index.js";
import { getTemplate } from "../../schemas/index.js";
import type { ProviderDef } from "../types.js";

export const stripe: ProviderDef = {
  id: "stripe",
  signer: stripeSigner,
  contentType: "application/json",
  apiVersions: ["2024-06-20"],
  events: {
    "customer.subscription.created": { schemaRef: "customer.subscription.created" },
    "invoice.payment_failed": { schemaRef: "invoice.payment_failed" },
    "customer.subscription.deleted": { schemaRef: "customer.subscription.deleted" },
  },
  resolveTemplate(event, apiVersion = "2024-06-20") {
    const tpl = getTemplate("stripe", event, apiVersion);
    if (!tpl) throw new Error(`No stripe template for ${event}@${apiVersion}`);
    return tpl;
  },
};
