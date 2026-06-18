/**
 * Template generation pipeline (§7.1).
 *
 *   spec (OpenAPI / JSON Schema)
 *     -> JSON Schema per event
 *     -> json-schema-faker (seeded)
 *     -> realistic default template
 *     -> committed artifact at src/templates/<provider>/<apiVersion>/<event>.json
 *
 * Sources: Stripe official versioned OpenAPI; @octokit/webhooks-schemas for
 * GitHub; Shopify/Twilio OpenAPI. We maintain this TRANSFORM, not a fixtures
 * folder. Deferred to Phase 1.5 — flagship templates are curated by hand first.
 */
async function main() {
  // TODO: load spec, walk events, run json-schema-faker with a fixed seed,
  //       write artifacts, then validate each against its source schema (§13).
  console.log("[generate] not yet implemented — curated templates are committed for MVP.");
}

main();
