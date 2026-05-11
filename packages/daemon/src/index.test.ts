import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "./index.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "context-passport-daemon-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("daemon API", () => {
  it("captures browser note payloads into bundle directories", async () => {
    const root = await makeTempDir();
    const app = createServer({ workspaceDir: root });

    const response = await app.inject({
      method: "POST",
      url: "/capture/note",
      payload: { title: "Browser capture", text: "Selected context from browser" },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as { path: string; bundleId: string };
    expect(body.bundleId).toContain("browser-capture");
    expect(await readFile(join(body.path, "artifacts", "manual-note.md"), "utf8")).toBe(
      "Selected context from browser\n",
    );
    await app.close();
  });
});
