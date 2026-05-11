import { describe, expect, it } from "vitest";
import {
  createBundle,
  stableStringifyBundle,
  validateBundle,
  calculateBundleHash,
} from "./index.js";

describe("context bundle", () => {
  it("creates a valid bundle with one web source and markdown artifact", () => {
    const bundle = createBundle({
      title: "Example page",
      description: "A captured web page",
      sources: [
        {
          id: "src_web_1",
          type: "web_page",
          title: "Example",
          url: "https://example.com",
          capturedAt: "2026-05-11T20:00:00.000Z",
        },
      ],
      artifacts: [
        {
          id: "art_markdown_1",
          sourceId: "src_web_1",
          type: "markdown",
          path: "artifacts/example.md",
          mediaType: "text/markdown",
          bytes: 18,
          sha256: "0".repeat(64),
        },
      ],
    });

    expect(validateBundle(bundle).success).toBe(true);
    expect(bundle.schemaVersion).toBe("0.1.0");
    expect(bundle.sources).toHaveLength(1);
    expect(bundle.artifacts).toHaveLength(1);
  });

  it("rejects artifacts pointing to missing sources", () => {
    const bundle = createBundle({
      title: "Broken bundle",
      sources: [],
      artifacts: [
        {
          id: "art_orphan",
          sourceId: "missing_source",
          type: "markdown",
          path: "artifacts/orphan.md",
          mediaType: "text/markdown",
          bytes: 10,
          sha256: "1".repeat(64),
        },
      ],
    });

    const result = validateBundle(bundle);

    expect(result.success).toBe(false);
    expect(result.errors).toContain("Artifact art_orphan references missing source missing_source");
  });

  it("serializes deterministically and produces stable hashes", () => {
    const bundle = createBundle({
      title: "Stable bundle",
      sources: [
        {
          id: "src_note_1",
          type: "manual_note",
          title: "Note",
          capturedAt: "2026-05-11T20:00:00.000Z",
        },
      ],
      artifacts: [],
    });

    const first = stableStringifyBundle(bundle);
    const second = stableStringifyBundle(bundle);

    expect(first).toBe(second);
    expect(calculateBundleHash(bundle)).toMatch(/^[a-f0-9]{64}$/);
    expect(calculateBundleHash(bundle)).toBe(calculateBundleHash(bundle));
  });
});
