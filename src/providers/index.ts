import type { ProviderDef, ProviderId } from "./types.js";
import { stripe } from "./defs/stripe.js";
import { github } from "./defs/github.js";

export type { ProviderDef, ProviderId, EventDef } from "./types.js";

export const providers: Record<string, ProviderDef> = { stripe, github };

export function getProvider(id: string): ProviderDef {
  const p = providers[id];
  if (!p) throw new Error(`Unknown provider: ${id}. Known: ${Object.keys(providers).join(", ")}`);
  return p;
}
