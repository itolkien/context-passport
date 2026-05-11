import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  captureFileBundle,
  captureNoteBundle,
  exportBundleArchive,
  importBundleArchive,
  inspectBundlePath,
  redactBundlePath,
  validateBundlePath,
} from "./index.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "context-passport-cli-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("CLI bundle workflows", () => {
  it("captures a manual note as a valid bundle directory", async () => {
    const workspace = await makeTempDir();
    const out = join(workspace, "bundle");

    const result = await captureNoteBundle({
      note: "Debug handoff: API key sk-1234567890abcdefghijklmnopqrstuvwxyz must be masked.",
      title: "Debug handoff",
      out,
    });

    expect(result.bundle.title).toBe("Debug handoff");
    expect(await validateBundlePath(out)).toEqual({ success: true, errors: [] });
    expect(await readFile(join(out, "artifacts", "manual-note.md"), "utf8")).toContain("Debug handoff");
  });

  it("captures a local file artifact with content hash", async () => {
    const workspace = await makeTempDir();
    const sourceFile = join(workspace, "debug.log");
    const out = join(workspace, "file-bundle");
    await writeFile(sourceFile, "stack trace\nline 2\n", "utf8");

    const result = await captureFileBundle({ file: sourceFile, title: "Debug log", out });

    expect(result.bundle.sources[0]).toMatchObject({ type: "file", title: "Debug log" });
    expect(result.bundle.artifacts[0]).toMatchObject({
      type: "text",
      path: "artifacts/debug.log",
      mediaType: "text/plain",
    });
    expect(await readFile(join(out, "artifacts", "debug.log"), "utf8")).toBe("stack trace\nline 2\n");
    expect(await validateBundlePath(out)).toEqual({ success: true, errors: [] });
  });

  it("exports and imports a portable archive without losing artifacts", async () => {
    const workspace = await makeTempDir();
    const bundleDir = join(workspace, "bundle");
    const archivePath = join(workspace, "bundle.cpb.zip");
    const importedDir = join(workspace, "imported");

    await captureNoteBundle({ note: "Portable context", title: "Portable", out: bundleDir });
    await exportBundleArchive(bundleDir, archivePath);
    await importBundleArchive(archivePath, importedDir);

    expect((await stat(archivePath)).size).toBeGreaterThan(100);
    expect((await readFile(archivePath)).subarray(0, 2).toString("utf8")).toBe("PK");
    expect(await validateBundlePath(importedDir)).toEqual({ success: true, errors: [] });
    expect(await readFile(join(importedDir, "artifacts", "manual-note.md"), "utf8")).toBe("Portable context\n");
  });

  it("inspects and redacts bundle artifacts", async () => {
    const workspace = await makeTempDir();
    const bundleDir = join(workspace, "bundle");

    await captureNoteBundle({
      note: "Contact talha@example.com and token ghp_1234567890abcdefghijklmnopqrstuvwxyz123456",
      title: "Secrets",
      out: bundleDir,
    });

    const preview = await redactBundlePath(bundleDir, { apply: false });
    expect(preview.findings).toHaveLength(2);
    expect(await readFile(join(bundleDir, "artifacts", "manual-note.md"), "utf8")).toContain("talha@example.com");

    await redactBundlePath(bundleDir, { apply: true });
    const artifact = await readFile(join(bundleDir, "artifacts", "manual-note.md"), "utf8");
    expect(artifact).not.toContain("talha@example.com");
    expect(artifact).toContain("[REDACTED:email]");

    const inspection = await inspectBundlePath(bundleDir);
    expect(inspection).toContain("Secrets");
    expect(inspection).toContain("sources: 1");
    expect(inspection).toContain("artifacts: 1");
  });

  it("rejects artifact paths that escape the bundle directory", async () => {
    const workspace = await makeTempDir();
    const bundleDir = join(workspace, "bundle");

    await captureNoteBundle({ note: "Safe", title: "Safe", out: bundleDir });
    const manifestPath = join(bundleDir, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      artifacts: Array<{ path: string }>;
    };
    manifest.artifacts[0]!.path = "../bundle-evil/pwn.md";
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    await expect(exportBundleArchive(bundleDir, join(workspace, "out.cpb.json"))).rejects.toThrow(
      "escapes bundle directory",
    );
  });

  it("rejects bundle validation when artifact bytes do not match the manifest", async () => {
    const workspace = await makeTempDir();
    const bundleDir = join(workspace, "bundle");

    await captureNoteBundle({ note: "Original", title: "Original", out: bundleDir });
    await writeFile(join(bundleDir, "artifacts", "manual-note.md"), "Tampered\n", "utf8");

    const result = await validateBundlePath(bundleDir);

    expect(result.success).toBe(false);
    expect(result.errors.join("\n")).toContain("sha256 mismatch");
  });

  it("rejects portable archives with tampered artifact payloads", async () => {
    const workspace = await makeTempDir();
    const bundleDir = join(workspace, "bundle");
    const archivePath = join(workspace, "bundle.cpb.zip");

    await captureNoteBundle({ note: "Trusted", title: "Trusted", out: bundleDir });
    await exportBundleArchive(bundleDir, archivePath);

    const zip = await JSZip.loadAsync(await readFile(archivePath));
    zip.file("artifacts/manual-note.md", "Tainted\n");
    await writeFile(archivePath, await zip.generateAsync({ type: "nodebuffer" }));

    await expect(importBundleArchive(archivePath, join(workspace, "imported"))).rejects.toThrow("sha256 mismatch");
  });

  it("rejects archives that try to overwrite reserved bundle files", async () => {
    const workspace = await makeTempDir();
    const archivePath = join(workspace, "reserved.cpb.zip");
    const maliciousPayload = "{}\n";
    const bundle = {
      schemaVersion: "0.1.0",
      id: "reserved-overwrite",
      title: "Reserved overwrite",
      createdAt: "2026-05-11T20:00:00.000Z",
      sources: [
        {
          id: "src_note_1",
          type: "manual_note",
          title: "Note",
          capturedAt: "2026-05-11T20:00:00.000Z",
          metadata: {},
        },
      ],
      artifacts: [
        {
          id: "art_manifest",
          sourceId: "src_note_1",
          type: "json",
          path: "manifest.json",
          mediaType: "application/json",
          bytes: Buffer.byteLength(maliciousPayload),
          sha256: createHash("sha256").update(maliciousPayload).digest("hex"),
          metadata: {},
        },
      ],
      redactions: [],
      tags: [],
      metadata: {},
    };
    const zip = new JSZip();
    zip.file("manifest.json", `${JSON.stringify(bundle, null, 2)}\n`);
    await writeFile(archivePath, await zip.generateAsync({ type: "nodebuffer" }));

    await expect(importBundleArchive(archivePath, join(workspace, "imported"))).rejects.toThrow("Invalid bundle archive");
  });

  it("rejects legacy JSON archives with unexpected artifact payloads", async () => {
    const workspace = await makeTempDir();
    const archivePath = join(workspace, "legacy.cpb.json");
    const artifactText = "Expected\n";
    const bundle = {
      schemaVersion: "0.1.0",
      id: "legacy-extra",
      title: "Legacy extra",
      createdAt: "2026-05-11T20:00:00.000Z",
      sources: [
        {
          id: "src_note_1",
          type: "manual_note",
          title: "Note",
          capturedAt: "2026-05-11T20:00:00.000Z",
          metadata: {},
        },
      ],
      artifacts: [
        {
          id: "art_note_1",
          sourceId: "src_note_1",
          type: "markdown",
          path: "artifacts/note.md",
          mediaType: "text/markdown",
          bytes: Buffer.byteLength(artifactText),
          sha256: createHash("sha256").update(artifactText).digest("hex"),
          metadata: {},
        },
      ],
      redactions: [],
      tags: [],
      metadata: {},
    };
    await writeFile(
      archivePath,
      `${JSON.stringify(
        {
          archiveVersion: 1,
          bundle,
          artifacts: [
            { path: "artifacts/note.md", dataBase64: Buffer.from(artifactText).toString("base64") },
            { path: "artifacts/extra.md", dataBase64: Buffer.from("Unexpected\n").toString("base64") },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    await expect(importBundleArchive(archivePath, join(workspace, "imported"))).rejects.toThrow(
      "unexpected artifact payload artifacts/extra.md",
    );
  });

  it("redacts sensitive strings from manifest fields", async () => {
    const workspace = await makeTempDir();
    const bundleDir = join(workspace, "bundle");

    await captureNoteBundle({
      note: "Body without secrets",
      title: "Token ghp_1234567890abcdefghijklmnopqrstuvwxyz123456",
      out: bundleDir,
    });

    await redactBundlePath(bundleDir, { apply: true });

    const manifest = await readFile(join(bundleDir, "manifest.json"), "utf8");
    expect(manifest).not.toContain("ghp_1234567890abcdefghijklmnopqrstuvwxyz123456");
    expect(manifest).toContain("[REDACTED:github_token]");
  });
});
