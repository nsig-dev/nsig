import { Command } from "commander";

export const loginCommand = new Command("login")
  .description("Store your license key to unlock pro features (AI, cloud sync, CI history)")
  .action(async () => {
    // TODO: prompt for key, verify server-side, persist to OS keychain. Degrades to free offline.
    console.log("login: not yet implemented (Phase 2 — license key flow).");
  });
