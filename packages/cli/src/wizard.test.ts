import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { captureNoteBundle, runInteractiveWizard, validateBundlePath } from "./index.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "context-passport-wizard-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("interactive wizard", () => {
  it("guides a user from manual note capture through redaction and zip export", async () => {
    const workspace = await makeTempDir();
    const bundleDir = join(workspace, "debug-handoff");
    const prompts = [
      "1",
      "1",
      "Debug handoff",
      "Contact talha@example.com and token ghp_12...3456",
      bundleDir,
      "y",
      "y",
    ];
    const output: string[] = [];

    const result = await runInteractiveWizard({
      prompt: async () => prompts.shift() ?? "",
      write: (line) => output.push(line),
    });

    expect(result?.bundlePath).toBe(bundleDir);
    expect(result?.archivePath).toBe(`${bundleDir}.cpb.zip`);
    expect(await validateBundlePath(bundleDir)).toEqual({ success: true, errors: [] });
    expect((await stat(`${bundleDir}.cpb.zip`)).size).toBeGreaterThan(100);
    expect(await readFile(join(bundleDir, "artifacts", "manual-note.md"), "utf8")).toContain(
      "[REDACTED:email]",
    );
    const transcript = output.join("\n");
    expect(transcript).toContain("╭─ Context Passport");
    expect(transcript).toContain("Step 1/4 · Choose workflow");
    expect(transcript).toContain("Step 2/4 · Capture source");
    expect(transcript).toContain("Step 3/4 · Privacy check");
    expect(transcript).toContain("Step 4/4 · Export");
    expect(transcript).toContain("✓ Bundle created");
    expect(transcript).toContain("! Secret findings: 1");
    expect(transcript).toContain("✓ Export ready");
    expect(transcript).toContain("Next: share this .cpb.zip with another AI tool or teammate.");
  });

  it("does not overwrite an existing output directory unless the user confirms", async () => {
    const workspace = await makeTempDir();
    const existingDir = join(workspace, "existing-output");
    const markerPath = join(existingDir, "keep.txt");
    await mkdir(existingDir, { recursive: true });
    await writeFile(markerPath, "do not delete", "utf8");
    const prompts = ["1", "1", "Danger handoff", "Contact talha@example.com", existingDir, "n"];
    const output: string[] = [];

    await expect(
      runInteractiveWizard({
        prompt: async () => prompts.shift() ?? "",
        write: (line) => output.push(line),
      }),
    ).rejects.toThrow("Output directory already exists");

    expect(await readFile(markerPath, "utf8")).toBe("do not delete");
    expect(output.join("\n")).toContain("Output already exists");
  });

  it("does not overwrite an existing archive from the wizard unless the user confirms", async () => {
    const workspace = await makeTempDir();
    const bundleDir = join(workspace, "existing-bundle");
    const archivePath = join(workspace, "existing-bundle.cpb.zip");
    await captureNoteBundle({ note: "Existing handoff", title: "Existing", out: bundleDir });
    await writeFile(archivePath, "keep archive", "utf8");
    const prompts = ["4", bundleDir, archivePath, "n"];
    const output: string[] = [];

    await expect(
      runInteractiveWizard({
        prompt: async () => prompts.shift() ?? "",
        write: (line) => output.push(line),
      }),
    ).rejects.toThrow("Archive path already exists");

    expect(await readFile(archivePath, "utf8")).toBe("keep archive");
    expect(output.join("\n")).toContain("Archive already exists");
  });
});
