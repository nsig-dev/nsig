import { Command } from "commander";

export const listenCommand = new Command("listen")
  .description("Capture real webhooks locally and replay them (optional)")
  .requiredOption("--to <url>", "where to replay captured events")
  .action(async () => {
    // TODO: local capture server + replay. Mirrors the hosted inbox (§10).
    console.log("listen: not yet implemented (Phase 2).");
  });
