import { describe, expect, it } from "vitest";
import { createProgram } from "./index.js";

describe("CLI program", () => {
  it("registers the v0 command surface", () => {
    const program = createProgram();
    const commandNames = program.commands.map((command) => command.name()).sort();

    expect(commandNames).toEqual([
      "capture",
      "export",
      "import",
      "init",
      "inspect",
      "redact",
      "validate",
    ]);
  });
});
