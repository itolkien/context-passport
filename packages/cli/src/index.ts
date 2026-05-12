#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, basename, extname } from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import JSZip from "jszip";
import {
  type BundleArtifact,
  type ContextBundle,
  calculateBundleHash,
  createBundle,
  redactText,
  validateArtifactPath,
  validateBundle,
} from "@context-passport/core";

const MANIFEST_FILE = "manifest.json";
const ARTIFACTS_DIR = "artifacts";
const DEFAULT_BUNDLE_DIR = "context-passport-bundle";

type CaptureNoteInput = {
  note: string;
  title?: string;
  out?: string;
};

type CaptureUrlInput = {
  url: string;
  title?: string;
  out?: string;
};

type CaptureFileInput = {
  file: string;
  title?: string;
  out?: string;
};

type CaptureResult = {
  bundle: ContextBundle;
  path: string;
};

type PortableArchive = {
  archiveVersion: 1;
  bundle: ContextBundle;
  artifacts: Array<{ path: string; dataBase64: string }>;
};

export type InteractiveWizardIO = {
  prompt: (question: string) => Promise<string>;
  write: (line: string) => void;
  close?: () => void;
};

export type InteractiveWizardResult = {
  bundlePath: string;
  archivePath?: string;
};

export async function captureNoteBundle(input: CaptureNoteInput): Promise<CaptureResult> {
  const now = new Date().toISOString();
  const title = input.title ?? firstUsefulLine(input.note) ?? "Manual note";
  const artifactText = ensureTrailingNewline(input.note);
  const artifact = createTextArtifact({
    id: "art_manual_note",
    sourceId: "src_manual_note",
    path: "artifacts/manual-note.md",
    text: artifactText,
    mediaType: "text/markdown",
  });
  const bundle = createBundle({
    title,
    sources: [
      {
        id: "src_manual_note",
        type: "manual_note",
        title,
        capturedAt: now,
      },
    ],
    artifacts: [artifact],
    createdAt: now,
  });

  const out = resolve(input.out ?? DEFAULT_BUNDLE_DIR);
  await writeBundleDirectory(out, bundle, [{ artifact, text: artifactText }]);
  return { bundle, path: out };
}

export async function captureUrlBundle(input: CaptureUrlInput): Promise<CaptureResult> {
  const response = await fetch(input.url, { headers: { "user-agent": "context-passport/0.2" } });
  if (!response.ok) {
    throw new Error(`Failed to capture URL ${input.url}: HTTP ${response.status}`);
  }

  const html = await response.text();
  const title = input.title ?? extractHtmlTitle(html) ?? input.url;
  const markdown = htmlToReadableMarkdown(html, input.url);
  const now = new Date().toISOString();
  const sourceType = classifyUrl(input.url);
  const artifact = createTextArtifact({
    id: "art_page_markdown",
    sourceId: "src_page",
    path: "artifacts/page.md",
    text: markdown,
    mediaType: "text/markdown",
  });
  const bundle = createBundle({
    title,
    sources: [
      {
        id: "src_page",
        type: sourceType,
        title,
        url: input.url,
        capturedAt: now,
        metadata: { contentType: response.headers.get("content-type") ?? "unknown" },
      },
    ],
    artifacts: [artifact],
    createdAt: now,
  });

  const out = resolve(input.out ?? slugify(title));
  await writeBundleDirectory(out, bundle, [{ artifact, text: markdown }]);
  return { bundle, path: out };
}

export async function captureFileBundle(input: CaptureFileInput): Promise<CaptureResult> {
  const sourcePath = resolve(input.file);
  const bytes = await readFile(sourcePath);
  const filename = safeArtifactName(basename(sourcePath));
  const now = new Date().toISOString();
  const title = input.title ?? filename;
  const mediaType = guessMediaType(filename);
  const artifactPath = `artifacts/${filename}`;
  const artifact: BundleArtifact = {
    id: "art_file",
    sourceId: "src_file",
    type: mediaType.startsWith("image/") ? "image" : "text",
    path: artifactPath,
    mediaType,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    metadata: { originalPath: sourcePath },
  };
  const bundle = createBundle({
    title,
    sources: [
      {
        id: "src_file",
        type: mediaType.startsWith("image/") ? "screenshot" : "file",
        title,
        capturedAt: now,
        metadata: { filename, originalPath: sourcePath },
      },
    ],
    artifacts: [artifact],
    createdAt: now,
  });

  const out = resolve(input.out ?? slugify(title));
  await rm(out, { recursive: true, force: true });
  await mkdir(dirname(resolveArtifactPath(out, artifactPath)), { recursive: true });
  await writeFile(join(out, MANIFEST_FILE), `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  await writeFile(resolveArtifactPath(out, artifactPath), bytes);
  return { bundle, path: out };
}

export async function validateBundlePath(path: string) {
  const resolved = resolve(path);
  const stats = await stat(resolved);
  const archive = stats.isFile() ? await readPortableArchive(resolved) : undefined;
  const bundle =
    archive?.bundle ??
    (JSON.parse(await readFile(join(resolved, MANIFEST_FILE), "utf8")) as ContextBundle);
  const manifestValidation = validateBundle(bundle);
  if (!manifestValidation.success) {
    return manifestValidation;
  }
  const artifactPayloads =
    archive?.artifacts ?? (await readDirectoryArtifactPayloads(resolved, bundle));
  return validateArchiveArtifacts(bundle, artifactPayloads);
}

export async function exportBundleArchive(
  bundlePath: string,
  archivePath?: string,
): Promise<string> {
  const { bundle, artifacts } = await readBundle(bundlePath);
  const validation = validateBundle(bundle);
  if (!validation.success) {
    throw new Error(`Invalid bundle: ${validation.errors.join("; ")}`);
  }
  const out = resolve(archivePath ?? `${bundle.id}.cpb.zip`);
  await mkdir(dirname(out), { recursive: true });

  const zip = new JSZip();
  zip.file(MANIFEST_FILE, `${JSON.stringify(bundle, null, 2)}\n`);
  for (const artifact of artifacts) {
    const bytes = await readFile(resolveArtifactPath(bundlePath, artifact.path));
    validateArtifactBytes(artifact, bytes);
    zip.file(artifact.path, bytes);
  }

  const archive = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  await writeFile(out, archive);
  return out;
}

export async function importBundleArchive(archivePath: string, outPath?: string): Promise<string> {
  const archive = await readPortableArchive(archivePath);
  if (archive.archiveVersion !== 1) {
    throw new Error(`Unsupported archive version: ${String(archive.archiveVersion)}`);
  }

  const validation = validateBundle(archive.bundle);
  if (!validation.success) {
    throw new Error(`Invalid bundle archive: ${validation.errors.join("; ")}`);
  }
  const artifactValidation = validateArchiveArtifacts(archive.bundle, archive.artifacts);
  if (!artifactValidation.success) {
    throw new Error(`Invalid bundle archive: ${artifactValidation.errors.join("; ")}`);
  }

  const out = resolve(outPath ?? archive.bundle.id);
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await writeFile(join(out, MANIFEST_FILE), `${JSON.stringify(archive.bundle, null, 2)}\n`, "utf8");
  for (const artifact of archive.artifacts) {
    const destination = resolveArtifactPath(out, artifact.path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, Buffer.from(artifact.dataBase64, "base64"));
  }
  return out;
}

async function readPortableArchive(archivePath: string): Promise<PortableArchive> {
  const buffer = await readFile(archivePath);
  if (buffer.subarray(0, 2).toString("utf8") !== "PK") {
    return JSON.parse(buffer.toString("utf8")) as PortableArchive;
  }

  const zip = await JSZip.loadAsync(buffer);
  const manifestEntry = zip.file(MANIFEST_FILE);
  if (!manifestEntry) {
    throw new Error("Invalid Context Passport archive: missing manifest.json");
  }

  const bundle = JSON.parse(await manifestEntry.async("string")) as ContextBundle;
  const allowedEntries = new Set([
    MANIFEST_FILE,
    ...bundle.artifacts.map((artifact) => artifact.path),
  ]);
  zip.forEach((entryPath, entry) => {
    if (!entry.dir && !allowedEntries.has(entryPath)) {
      throw new Error(`Invalid Context Passport archive: unexpected entry ${entryPath}`);
    }
  });
  const artifacts = await Promise.all(
    bundle.artifacts.map(async (artifact) => {
      const entry = zip.file(artifact.path);
      if (!entry) {
        throw new Error(`Invalid Context Passport archive: missing ${artifact.path}`);
      }
      return {
        path: artifact.path,
        dataBase64: (await entry.async("nodebuffer")).toString("base64"),
      };
    }),
  );

  return { archiveVersion: 1, bundle, artifacts };
}

export async function inspectBundlePath(path: string): Promise<string> {
  const { bundle } = await readBundle(path);
  const validation = validateBundle(bundle);
  const hash = calculateBundleHash(bundle);
  return [
    `Context Passport: ${bundle.title}`,
    `id: ${bundle.id}`,
    `schema: ${bundle.schemaVersion}`,
    `created: ${bundle.createdAt}`,
    `sources: ${bundle.sources.length}`,
    `artifacts: ${bundle.artifacts.length}`,
    `redactions: ${bundle.redactions.length}`,
    `valid: ${validation.success ? "yes" : "no"}`,
    `hash: ${hash}`,
  ].join("\n");
}

export async function redactBundlePath(path: string, options: { apply?: boolean } = {}) {
  const { bundle, artifacts } = await readBundle(path);
  const allFindings: Array<{
    artifactId: string;
    ruleId: string;
    start: number;
    end: number;
    replacement: string;
  }> = [];
  const updatedArtifacts: BundleArtifact[] = [];
  const manifestRedaction = redactManifestStrings(bundle);
  allFindings.push(
    ...manifestRedaction.findings.map((finding) => ({
      artifactId: "__manifest__",
      ruleId: finding.ruleId,
      start: finding.start,
      end: finding.end,
      replacement: finding.replacement,
    })),
  );

  for (const artifact of artifacts) {
    if (!artifact.mediaType.startsWith("text/") && artifact.mediaType !== "application/json") {
      updatedArtifacts.push(artifact);
      continue;
    }

    const artifactPath = resolveArtifactPath(path, artifact.path);
    const original = await readFile(artifactPath, "utf8");
    const redacted = redactText(original);
    allFindings.push(
      ...redacted.findings.map((finding) => ({
        artifactId: artifact.id,
        ruleId: finding.ruleId,
        start: finding.start,
        end: finding.end,
        replacement: finding.replacement,
      })),
    );

    if (options.apply && redacted.findings.length > 0) {
      await writeFile(artifactPath, redacted.text, "utf8");
      updatedArtifacts.push({
        ...artifact,
        bytes: Buffer.byteLength(redacted.text),
        sha256: sha256(redacted.text),
      });
    } else {
      updatedArtifacts.push(artifact);
    }
  }

  if (options.apply) {
    const updatedBundle: ContextBundle = {
      ...manifestRedaction.bundle,
      artifacts: updatedArtifacts,
      redactions: [
        ...manifestRedaction.bundle.redactions,
        ...allFindings.map((finding) => ({
          artifactId: finding.artifactId,
          ruleId: finding.ruleId,
          start: finding.start,
          end: finding.end,
          replacement: finding.replacement,
        })),
      ],
    };
    await writeFile(
      join(path, MANIFEST_FILE),
      `${JSON.stringify(updatedBundle, null, 2)}\n`,
      "utf8",
    );
  }

  return { findings: allFindings };
}

export async function runInteractiveWizard(
  io = createTerminalWizardIO(),
): Promise<InteractiveWizardResult | undefined> {
  try {
    return await runInteractiveWizardSteps(io);
  } finally {
    io.close?.();
  }
}

async function runInteractiveWizardSteps(
  io: InteractiveWizardIO,
): Promise<InteractiveWizardResult | undefined> {
  writeBanner(io);
  writeStep(io, "1/4", "Choose workflow");
  io.write("  1) Create a new context bundle");
  io.write("  2) Inspect an existing bundle");
  io.write("  3) Validate an existing bundle");
  io.write("  4) Export an existing bundle");
  io.write("");

  const action = normalizeMenuChoice(await io.prompt("Choose an option"));
  if (action === "2") {
    const bundlePath = await askRequired(io, "Bundle path");
    io.write(await inspectBundlePath(bundlePath));
    return { bundlePath: resolve(bundlePath) };
  }
  if (action === "3") {
    const bundlePath = await askRequired(io, "Bundle path");
    const validation = await validateBundlePath(bundlePath);
    io.write(
      validation.success
        ? "✓ Bundle is valid"
        : `✗ Bundle is invalid: ${validation.errors.join("; ")}`,
    );
    return { bundlePath: resolve(bundlePath) };
  }
  if (action === "4") {
    writeStep(io, "1/2", "Select existing bundle");
    const bundlePath = await askRequired(io, "Bundle path");
    const defaultArchivePath = `${bundlePath}.cpb.zip`;
    const archivePath = await askSafeArchivePath(io, defaultArchivePath);
    writeStep(io, "2/2", "Export");
    const exportedPath = await exportBundleArchive(bundlePath, archivePath);
    io.write(`✓ Export ready: ${exportedPath}`);
    io.write("Next: share this .cpb.zip with another AI tool or teammate.");
    return { bundlePath: resolve(bundlePath), archivePath: exportedPath };
  }
  if (action !== "1") {
    io.write("No action selected.");
    return undefined;
  }

  writeStep(io, "2/4", "Capture source");
  io.write("  1) Manual note");
  io.write("  2) Local file");
  io.write("  3) URL");
  io.write("");

  const source = normalizeMenuChoice(await io.prompt("Choose a source"));
  const title = await askOptional(io, "Bundle title");
  const captured =
    source === "2"
      ? await captureFileBundle({
          file: await askRequired(io, "File path"),
          ...createCaptureOptions(title, await askSafeOutputDirectory(io)),
        })
      : source === "3"
        ? await captureUrlBundle({
            url: await askRequired(io, "URL"),
            ...createCaptureOptions(title, await askSafeOutputDirectory(io)),
          })
        : await captureNoteBundle({
            note: await askRequired(io, "Note"),
            ...createCaptureOptions(title, await askSafeOutputDirectory(io)),
          });

  io.write("");
  io.write(`✓ Bundle created: ${captured.path}`);
  io.write(`  Sources: ${captured.bundle.sources.length}`);
  io.write(`  Artifacts: ${captured.bundle.artifacts.length}`);

  writeStep(io, "3/4", "Privacy check");
  const redactionPreview = await redactBundlePath(captured.path, { apply: false });
  io.write(`! Secret findings: ${redactionPreview.findings.length}`);
  if (redactionPreview.findings.length > 0 && (await askYesNo(io, "Apply redactions now?"))) {
    await redactBundlePath(captured.path, { apply: true });
    io.write("✓ Redactions applied.");
  }

  writeStep(io, "4/4", "Export");
  if (await askYesNo(io, "Export zip archive now?")) {
    const archivePath = await askSafeArchivePath(io, `${captured.path}.cpb.zip`);
    const exportedPath = await exportBundleArchive(captured.path, archivePath);
    io.write(`✓ Export ready: ${exportedPath}`);
    io.write("Next: share this .cpb.zip with another AI tool or teammate.");
    return { bundlePath: captured.path, archivePath };
  }

  io.write("Next: inspect or export this bundle when you are ready.");
  return { bundlePath: captured.path };
}

export function createProgram(): Command {
  const program = new Command();
  program
    .name("passport")
    .description("Create and inspect local-first AI context handoff bundles")
    .version("1.0.0")
    .action(async () => {
      await runInteractiveWizard();
    });

  program
    .command("init")
    .description("Initialize Context Passport configuration in the current project")
    .action(async () => {
      await writeFile(
        "context-passport.config.json",
        `${JSON.stringify({ schemaVersion: "0.1.0" }, null, 2)}\n`,
        "utf8",
      );
      console.log("created context-passport.config.json");
    });

  program
    .command("capture")
    .description("Capture context from a URL, file, note, or browser payload")
    .option("--url <url>", "URL to capture")
    .option("--file <path>", "File to capture")
    .option("--note <text>", "Manual note to capture")
    .option("--title <title>", "Bundle title")
    .option("--out <path>", "Output bundle directory")
    .action(
      async (options: {
        url?: string;
        file?: string;
        note?: string;
        title?: string;
        out?: string;
      }) => {
        const captureOptions = withoutUndefined({ title: options.title, out: options.out });
        const result = options.url
          ? await captureUrlBundle({ url: options.url, ...captureOptions })
          : options.file
            ? await captureFileBundle({ file: options.file, ...captureOptions })
            : await captureNoteBundle({ note: options.note ?? "", ...captureOptions });
        console.log(result.path);
      },
    );

  program
    .command("validate")
    .description("Validate a context bundle")
    .argument("<path>")
    .action(async (path: string) => {
      const result = await validateBundlePath(path);
      console.log(result.success ? "valid" : `invalid: ${result.errors.join("; ")}`);
      if (!result.success) {
        process.exitCode = 1;
      }
    });

  program
    .command("export")
    .description("Export a bundle directory to a portable archive")
    .argument("<path>")
    .option("--out <path>", "Archive output path")
    .action(async (path: string, options: { out?: string }) => {
      console.log(await exportBundleArchive(path, options.out));
    });

  program
    .command("import")
    .description("Import a portable bundle archive")
    .argument("<path>")
    .option("--out <path>", "Directory output path")
    .action(async (path: string, options: { out?: string }) => {
      console.log(await importBundleArchive(path, options.out));
    });

  program
    .command("inspect")
    .description("Print a human-readable bundle preview")
    .argument("<path>")
    .action(async (path: string) => {
      console.log(await inspectBundlePath(path));
    });

  program
    .command("redact")
    .description("Preview or apply redaction rules to bundle content")
    .argument("<path>")
    .option("--apply", "Write redacted output instead of previewing")
    .action(async (path: string, options: { apply?: boolean }) => {
      const result = await redactBundlePath(path, withoutUndefined({ apply: options.apply }));
      console.log(JSON.stringify(result, null, 2));
    });

  return program;
}

function createTerminalWizardIO(): InteractiveWizardIO {
  if (!process.stdin.isTTY) {
    const linesPromise = readStdinLines();
    let lines: string[] | undefined;
    return {
      prompt: async (question: string) => {
        process.stdout.write(`${question}: `);
        const bufferedLines = lines ?? (await linesPromise);
        lines = bufferedLines;
        return bufferedLines.shift() ?? "";
      },
      write: (line: string) => console.log(line),
    };
  }

  const readline = createInterface({ input: process.stdin, output: process.stdout });
  return {
    prompt: (question: string) => readline.question(`${question}: `),
    write: (line: string) => console.log(line),
    close: () => readline.close(),
  };
}

function normalizeMenuChoice(input: string): string {
  return input.trim().toLowerCase();
}

function writeBanner(io: InteractiveWizardIO): void {
  io.write("╭─ Context Passport");
  io.write("│  Local-first AI context handoff");
  io.write("╰─ Capture → redact → export");
  io.write("");
}

function writeStep(io: InteractiveWizardIO, step: string, title: string): void {
  io.write("");
  io.write(`Step ${step} · ${title}`);
}

async function readStdinLines(): Promise<string[]> {
  const chunks: string[] = [];
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) {
    chunks.push(String(chunk));
  }
  return chunks.join("").split(/\r?\n/);
}

async function askOptional(io: InteractiveWizardIO, question: string): Promise<string | undefined> {
  const answer = (await io.prompt(question)).trim();
  return answer.length > 0 ? answer : undefined;
}

async function askRequired(io: InteractiveWizardIO, question: string): Promise<string> {
  const answer = (await io.prompt(question)).trim();
  if (answer.length === 0) {
    throw new Error(`${question} is required`);
  }
  return answer;
}

async function askSafeOutputDirectory(io: InteractiveWizardIO): Promise<string> {
  const outputDirectory = await askRequired(io, "Output directory");
  if (await pathExists(outputDirectory)) {
    io.write(`! Output already exists: ${resolve(outputDirectory)}`);
    io.write("  Continuing will replace that directory and its contents.");
    if (!(await askYesNo(io, "Overwrite existing output directory?"))) {
      throw new Error("Output directory already exists; choose another path or confirm overwrite.");
    }
  }
  return outputDirectory;
}

async function askSafeArchivePath(
  io: InteractiveWizardIO,
  defaultArchivePath: string,
): Promise<string> {
  const archivePath =
    (await askOptional(io, `Archive path (${defaultArchivePath})`)) ?? defaultArchivePath;
  if (await pathExists(archivePath)) {
    io.write(`! Archive already exists: ${resolve(archivePath)}`);
    io.write("  Continuing will replace that archive file.");
    if (!(await askYesNo(io, "Overwrite existing archive?"))) {
      throw new Error("Archive path already exists; choose another path or confirm overwrite.");
    }
  }
  return archivePath;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function askYesNo(io: InteractiveWizardIO, question: string): Promise<boolean> {
  const answer = (await io.prompt(question)).trim().toLowerCase();
  return answer === "y" || answer === "yes";
}

function createCaptureOptions(
  title: string | undefined,
  out: string | undefined,
): { title?: string; out?: string } {
  const options: { title?: string; out?: string } = {};
  if (title !== undefined) {
    options.title = title;
  }
  if (out !== undefined) {
    options.out = out;
  }
  return options;
}

async function writeBundleDirectory(
  out: string,
  bundle: ContextBundle,
  artifacts: Array<{ artifact: BundleArtifact; text: string }>,
): Promise<void> {
  await rm(out, { recursive: true, force: true });
  await mkdir(join(out, ARTIFACTS_DIR), { recursive: true });
  await writeFile(join(out, MANIFEST_FILE), `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  for (const item of artifacts) {
    const artifactPath = resolveArtifactPath(out, item.artifact.path);
    await mkdir(dirname(artifactPath), { recursive: true });
    await writeFile(artifactPath, item.text, "utf8");
  }
}

async function readBundle(path: string): Promise<{
  bundle: ContextBundle;
  artifacts: BundleArtifact[];
  artifactPayloads: PortableArchive["artifacts"];
}> {
  const resolved = resolve(path);
  const stats = await stat(resolved);
  if (stats.isFile()) {
    const archive = await readPortableArchive(resolved);
    return {
      bundle: archive.bundle,
      artifacts: archive.bundle.artifacts,
      artifactPayloads: archive.artifacts,
    };
  }

  const bundle = JSON.parse(await readFile(join(resolved, MANIFEST_FILE), "utf8")) as ContextBundle;
  const artifactPayloads = await readDirectoryArtifactPayloads(resolved, bundle);
  return { bundle, artifacts: bundle.artifacts, artifactPayloads };
}

async function readDirectoryArtifactPayloads(
  bundleDir: string,
  bundle: ContextBundle,
): Promise<PortableArchive["artifacts"]> {
  return Promise.all(
    bundle.artifacts.map(async (artifact) => ({
      path: artifact.path,
      dataBase64: (await readFile(resolveArtifactPath(bundleDir, artifact.path))).toString(
        "base64",
      ),
    })),
  );
}

function createTextArtifact(input: {
  id: string;
  sourceId: string;
  path: string;
  text: string;
  mediaType: string;
}): BundleArtifact {
  return {
    id: input.id,
    sourceId: input.sourceId,
    type: input.mediaType === "text/markdown" ? "markdown" : "text",
    path: input.path,
    mediaType: input.mediaType,
    bytes: Buffer.byteLength(input.text),
    sha256: sha256(input.text),
    metadata: {},
  };
}

function withoutUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

function resolveArtifactPath(bundlePath: string, artifactPath: string): string {
  const pathValidation = validateArtifactPath(artifactPath);
  if (!pathValidation.success) {
    throw new Error(`Artifact path escapes bundle directory: ${artifactPath}`);
  }

  const root = resolve(bundlePath);
  const destination = resolve(root, pathValidation.normalizedPath);
  const relativeDestination = relative(root, destination);
  if (
    relativeDestination === ".." ||
    relativeDestination.startsWith(`..${"/"}`) ||
    relativeDestination.startsWith(`..${"\\"}`) ||
    isAbsolute(relativeDestination)
  ) {
    throw new Error(`Artifact path escapes bundle directory: ${artifactPath}`);
  }
  return destination;
}

function validateArchiveArtifacts(
  bundle: ContextBundle,
  artifacts: PortableArchive["artifacts"],
): { success: true; errors: [] } | { success: false; errors: string[] } {
  const errors: string[] = [];
  const archiveArtifactsByPath = new Map<string, string>();

  for (const artifact of artifacts) {
    if (archiveArtifactsByPath.has(artifact.path)) {
      errors.push(`Archive contains duplicate artifact payload ${artifact.path}`);
      continue;
    }
    archiveArtifactsByPath.set(artifact.path, artifact.dataBase64);
  }

  for (const artifact of bundle.artifacts) {
    const dataBase64 = archiveArtifactsByPath.get(artifact.path);
    if (dataBase64 === undefined) {
      errors.push(`Archive is missing artifact payload ${artifact.path}`);
      continue;
    }

    try {
      validateArtifactBytes(artifact, Buffer.from(dataBase64, "base64"));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const manifestPaths = new Set(bundle.artifacts.map((artifact) => artifact.path));
  for (const artifactPath of archiveArtifactsByPath.keys()) {
    if (!manifestPaths.has(artifactPath)) {
      errors.push(`Archive contains unexpected artifact payload ${artifactPath}`);
    }
  }

  return errors.length === 0 ? { success: true, errors: [] } : { success: false, errors };
}

function validateArtifactBytes(artifact: BundleArtifact, bytes: Buffer): void {
  if (bytes.byteLength !== artifact.bytes) {
    throw new Error(
      `Artifact ${artifact.id} byte length mismatch for ${artifact.path}: expected ${artifact.bytes}, got ${bytes.byteLength}`,
    );
  }
  const actualSha256 = createHash("sha256").update(bytes).digest("hex");
  if (actualSha256 !== artifact.sha256.toLowerCase()) {
    throw new Error(
      `Artifact ${artifact.id} sha256 mismatch for ${artifact.path}: expected ${artifact.sha256}, got ${actualSha256}`,
    );
  }
}

function redactManifestStrings(bundle: ContextBundle): {
  bundle: ContextBundle;
  findings: Array<{ ruleId: string; start: number; end: number; replacement: string }>;
} {
  const findings: Array<{ ruleId: string; start: number; end: number; replacement: string }> = [];
  const redacted = redactJsonValue(bundle, [], findings) as ContextBundle;
  return { bundle: redacted, findings };
}

function redactJsonValue(
  value: unknown,
  path: string[],
  findings: Array<{ ruleId: string; start: number; end: number; replacement: string }>,
): unknown {
  if (typeof value === "string") {
    if (shouldSkipManifestRedaction(path)) {
      return value;
    }
    const result = redactText(value);
    findings.push(
      ...result.findings.map((finding) => ({
        ruleId: finding.ruleId,
        start: finding.start,
        end: finding.end,
        replacement: finding.replacement,
      })),
    );
    return result.text;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => redactJsonValue(item, [...path, String(index)], findings));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        redactJsonValue(nested, [...path, key], findings),
      ]),
    );
  }

  return value;
}

function shouldSkipManifestRedaction(path: string[]): boolean {
  const last = path.at(-1);
  return last === "path" || last === "sha256" || last === "mediaType" || last === "schemaVersion";
}

function safeArtifactName(filename: string): string {
  const safe = filename.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-|-$/g, "");
  return safe || "artifact.txt";
}

function guessMediaType(filename: string): string {
  const extension = extname(filename).toLowerCase();
  const mediaTypes: Record<string, string> = {
    ".md": "text/markdown",
    ".txt": "text/plain",
    ".log": "text/plain",
    ".json": "application/json",
    ".html": "text/html",
    ".htm": "text/html",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
  };
  return mediaTypes[extension] ?? "text/plain";
}

function firstUsefulLine(text: string): string | undefined {
  const line = text
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.length > 0);
  return line ? line.slice(0, 80) : undefined;
}

function ensureTrailingNewline(text: string): string {
  return text.endsWith("\n") ? text : `${text}\n`;
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) || DEFAULT_BUNDLE_DIR
  );
}

function classifyUrl(url: string): "web_page" | "github_repo" | "github_issue" {
  const parsed = new URL(url);
  if (parsed.hostname === "github.com") {
    if (/\/issues\/\d+/.test(parsed.pathname)) {
      return "github_issue";
    }
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      return "github_repo";
    }
  }
  return "web_page";
}

function extractHtmlTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, " ").trim();
}

function htmlToReadableMarkdown(html: string, url: string): string {
  const title = extractHtmlTitle(html) ?? url;
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 400)
    .join("\n\n");
  return `# ${title}\n\nSource: ${url}\n\n${body}\n`;
}

async function isCliEntrypoint(): Promise<boolean> {
  if (!process.argv[1]) {
    return false;
  }
  return (await realpath(process.argv[1])) === (await realpath(fileURLToPath(import.meta.url)));
}

if (await isCliEntrypoint()) {
  createProgram()
    .parseAsync(process.argv)
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
