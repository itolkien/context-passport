#!/usr/bin/env node
import process from "node:process";
import { Command } from "commander";

const NOT_IMPLEMENTED = "not implemented yet";

export function createProgram(): Command {
  const program = new Command();
  program
    .name("passport")
    .description("Create and inspect local-first AI context handoff bundles")
    .version("0.1.0");

  program
    .command("init")
    .description("Initialize Context Passport configuration in the current project")
    .action(() => {
      console.log(`init is ${NOT_IMPLEMENTED}`);
    });

  program
    .command("capture")
    .description("Capture context from a URL, file, note, or browser payload")
    .option("--url <url>", "URL to capture")
    .option("--note <text>", "Manual note to capture")
    .option("--out <path>", "Output bundle directory or archive")
    .action((options: { url?: string; note?: string; out?: string }) => {
      console.log(`capture is ${NOT_IMPLEMENTED}: ${JSON.stringify(options)}`);
    });

  program
    .command("validate")
    .description("Validate a context bundle")
    .argument("<path>")
    .action((path: string) => {
      console.log(`validate is ${NOT_IMPLEMENTED}: ${path}`);
    });

  program
    .command("export")
    .description("Export a bundle directory to a portable archive")
    .argument("<path>")
    .option("--out <path>", "Archive output path")
    .action((path: string, options: { out?: string }) => {
      console.log(`export is ${NOT_IMPLEMENTED}: ${JSON.stringify({ path, ...options })}`);
    });

  program
    .command("import")
    .description("Import a portable bundle archive")
    .argument("<path>")
    .option("--out <path>", "Directory output path")
    .action((path: string, options: { out?: string }) => {
      console.log(`import is ${NOT_IMPLEMENTED}: ${JSON.stringify({ path, ...options })}`);
    });

  program
    .command("inspect")
    .description("Print a human-readable bundle preview")
    .argument("<path>")
    .action((path: string) => {
      console.log(`inspect is ${NOT_IMPLEMENTED}: ${path}`);
    });

  program
    .command("redact")
    .description("Preview or apply redaction rules to bundle content")
    .argument("<path>")
    .option("--apply", "Write redacted output instead of previewing")
    .action((path: string, options: { apply?: boolean }) => {
      console.log(`redact is ${NOT_IMPLEMENTED}: ${JSON.stringify({ path, ...options })}`);
    });

  return program;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createProgram().parse(process.argv);
}
