import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import process from "node:process";
import Fastify from "fastify";
import { createBundle } from "@context-passport/core";

type ServerOptions = {
  workspaceDir?: string;
};

type CaptureNotePayload = {
  title?: string;
  text?: string;
};

export function createServer(options: ServerOptions = {}) {
  const app = Fastify({ logger: false });
  const workspaceDir = resolve(options.workspaceDir ?? ".context-passport");

  app.get("/health", async () => ({ ok: true }));

  app.post<{ Body: CaptureNotePayload }>("/capture/note", async (request, reply) => {
    const text = request.body.text;
    if (!text || text.trim().length === 0) {
      return reply.code(400).send({ error: "text is required" });
    }

    const title = request.body.title?.trim() || "Browser capture";
    const now = new Date().toISOString();
    const artifactText = text.endsWith("\n") ? text : `${text}\n`;
    const artifact = {
      id: "art_manual_note",
      sourceId: "src_browser_note",
      type: "markdown" as const,
      path: "artifacts/manual-note.md",
      mediaType: "text/markdown",
      bytes: Buffer.byteLength(artifactText),
      sha256: sha256(artifactText),
      metadata: { origin: "browser_extension" },
    };
    const bundle = createBundle({
      title,
      sources: [
        {
          id: "src_browser_note",
          type: "selected_text",
          title,
          capturedAt: now,
          metadata: { origin: "browser_extension" },
        },
      ],
      artifacts: [artifact],
      createdAt: now,
      metadata: { capturedBy: "context-passport-daemon" },
    });

    const bundlePath = join(workspaceDir, bundle.id);
    await rm(bundlePath, { recursive: true, force: true });
    await mkdir(join(bundlePath, "artifacts"), { recursive: true });
    await writeFile(join(bundlePath, "manifest.json"), `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
    await writeFile(join(bundlePath, "artifacts", "manual-note.md"), artifactText, "utf8");

    return reply.code(201).send({ path: bundlePath, bundleId: bundle.id });
  });

  return app;
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.CONTEXT_PASSPORT_PORT ?? "17345");
  createServer()
    .listen({ host: "127.0.0.1", port })
    .then(() => {
      console.log(`Context Passport daemon listening on http://127.0.0.1:${port}`);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
