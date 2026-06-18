#!/usr/bin/env node
import { Command } from "commander";
import { config as loadEnv } from "dotenv";
import { runCommand } from "./commands/run.js";
import { fireCommand } from "./commands/fire.js";
import { listCommand } from "./commands/list.js";
import { initCommand } from "./commands/init/index.js";
import { loginCommand } from "./commands/login.js";
import { listenCommand } from "./commands/listen.js";

const program = new Command();
program
  .name("nsig")
  .description("Fire realistic, correctly-signed webhook event sequences at your endpoint.")
  .version("0.0.0")
  .option(
    "--env-file <path>",
    "load environment variables from this file (defaults to .env in the current directory)",
  );

/**
 * Load secrets the same way the app under test does — from a .env file — so users
 * never have to `export STRIPE_WEBHOOK_SECRET=…` by hand. An explicit shell export
 * still wins (dotenv does not override already-set vars).
 */
program.hook("preAction", (thisCommand) => {
  const path = (thisCommand.opts().envFile as string | undefined) ?? ".env";
  loadEnv({ path });
});

program.addCommand(initCommand);
program.addCommand(listCommand);
program.addCommand(fireCommand);
program.addCommand(runCommand);
program.addCommand(listenCommand);
program.addCommand(loginCommand);

program.parseAsync();
