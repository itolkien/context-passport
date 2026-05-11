import { createHash } from "node:crypto";
import { z } from "zod";

export const CONTEXT_PASSPORT_SCHEMA_VERSION = "0.1.0";

export const SourceTypeSchema = z.enum([
  "web_page",
  "github_repo",
  "github_issue",
  "selected_text",
  "manual_note",
  "screenshot",
  "file",
  "chat",
]);

export const ArtifactTypeSchema = z.enum([
  "markdown",
  "text",
  "html",
  "image",
  "ocr_text",
  "json",
  "patch",
]);

export const BundleSourceSchema = z.object({
  id: z.string().min(1),
  type: SourceTypeSchema,
  title: z.string().min(1),
  url: z.string().url().optional(),
  capturedAt: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const BundleArtifactSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  type: ArtifactTypeSchema,
  path: z.string().min(1),
  mediaType: z.string().min(1),
  bytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const ContextBundleSchema = z.object({
  schemaVersion: z.literal(CONTEXT_PASSPORT_SCHEMA_VERSION),
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  createdAt: z.string().datetime(),
  sources: z.array(BundleSourceSchema),
  artifacts: z.array(BundleArtifactSchema),
  redactions: z.array(z.unknown()).default([]),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type BundleSource = z.infer<typeof BundleSourceSchema>;
export type BundleArtifact = z.infer<typeof BundleArtifactSchema>;
export type ContextBundle = z.infer<typeof ContextBundleSchema>;

export type CreateBundleInput = {
  title: string;
  description?: string;
  sources: Array<Omit<BundleSource, "metadata"> & { metadata?: Record<string, unknown> }>;
  artifacts: Array<Omit<BundleArtifact, "metadata"> & { metadata?: Record<string, unknown> }>;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

export type BundleValidationResult =
  | { success: true; errors: [] }
  | { success: false; errors: string[] };

export function createBundle(input: CreateBundleInput): ContextBundle {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const bundle: ContextBundle = {
    schemaVersion: CONTEXT_PASSPORT_SCHEMA_VERSION,
    id: createBundleId(input.title, createdAt),
    title: input.title,
    ...(input.description === undefined ? {} : { description: input.description }),
    createdAt,
    sources: input.sources.map((source) => ({ metadata: {}, ...source })),
    artifacts: input.artifacts.map((artifact) => ({ metadata: {}, ...artifact })),
    redactions: [],
    tags: input.tags ?? [],
    metadata: input.metadata ?? {},
  };

  return ContextBundleSchema.parse(bundle);
}

export function validateBundle(bundle: unknown): BundleValidationResult {
  const parsed = ContextBundleSchema.safeParse(bundle);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.issues.map((issue) => issue.message) };
  }

  const sourceIds = new Set(parsed.data.sources.map((source) => source.id));
  const relationErrors = parsed.data.artifacts
    .filter((artifact) => !sourceIds.has(artifact.sourceId))
    .map((artifact) => `Artifact ${artifact.id} references missing source ${artifact.sourceId}`);

  if (relationErrors.length > 0) {
    return { success: false, errors: relationErrors };
  }

  return { success: true, errors: [] };
}

export function stableStringifyBundle(bundle: ContextBundle): string {
  return JSON.stringify(sortObject(bundle), null, 2);
}

export function calculateBundleHash(bundle: ContextBundle): string {
  return createHash("sha256").update(stableStringifyBundle(bundle)).digest("hex");
}

function createBundleId(title: string, createdAt: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  const hash = createHash("sha256").update(`${title}\n${createdAt}`).digest("hex").slice(0, 10);
  return `${slug || "bundle"}-${hash}`;
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortObject(nested)]),
    );
  }

  return value;
}
