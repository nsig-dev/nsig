// Diagnostic: find where Stripe's spec lists event types + how events map to objects.
const SPEC =
  process.env.STRIPE_SPEC_URL ??
  "https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json";

const spec = await (await fetch(SPEC)).json();
console.log("top-level keys:", Object.keys(spec));
console.log("components.schemas count:", Object.keys(spec.components?.schemas ?? {}).length);

const NEEDLE = "customer.subscription.created";

// 1) find every array that contains the needle (that's the event-type enum)
const arrayHits = [];
function walk(node, path) {
  if (Array.isArray(node)) {
    if (node.includes(NEEDLE)) arrayHits.push({ path, len: node.length, sample: node.slice(0, 4) });
    for (let i = 0; i < node.length; i++) walk(node[i], `${path}[${i}]`);
  } else if (node && typeof node === "object") {
    for (const k of Object.keys(node)) walk(node[k], path ? `${path}.${k}` : k);
  }
}
walk(spec, "");
console.log("\n--- arrays containing", NEEDLE, "---");
arrayHits.slice(0, 8).forEach((h) => console.log(`  ${h.path}  (len ${h.len})  e.g. ${JSON.stringify(h.sample)}`));

// 2) is there a schema key per event, or an x- annotation?
const schemaKeys = Object.keys(spec.components?.schemas ?? {});
console.log("\nschema key sample:", schemaKeys.slice(0, 8));
console.log("any schema key with a dot+event-ish name?:", schemaKeys.filter((k) => k.includes(".")).slice(0, 8));

// 3) show webhook_endpoint.enabled_events shape (what I wrongly assumed)
const we = spec.components?.schemas?.webhook_endpoint?.properties?.enabled_events;
console.log("\nwebhook_endpoint.enabled_events:", JSON.stringify(we)?.slice(0, 500));

// 4) does the spec carry an explicit event->object map anywhere? look for x-stripe* keys near events
const xkeys = new Set();
function findX(node) {
  if (node && typeof node === "object") {
    for (const k of Object.keys(node)) { if (k.startsWith("x-")) xkeys.add(k); findX(node[k]); }
  }
}
findX(spec);
console.log("\nx- extension keys present:", [...xkeys].slice(0, 20));
