import { createHash } from "node:crypto";
import { posix as pathPosix } from "node:path";
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

const ARTIFACT_PATH_PREFIX = "artifacts/";

export type RedactionRule = {
  id: string;
  label?: string;
  pattern: string | RegExp;
};

export type RedactionFinding = {
  ruleId: string;
  label: string;
  start: number;
  end: number;
  replacement: string;
};

export type RedactionOptions = {
  customRules?: RedactionRule[];
};

export type RedactionResult = {
  text: string;
  findings: RedactionFinding[];
};

const BUILT_IN_REDACTION_RULES: RedactionRule[] = [
  {
    id: "github_token",
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g,
  },
  {
    id: "openai_api_key",
    pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    id: "email",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  },
  {
    id: "local_path",
    pattern: /(?:\/home\/[A-Za-z0-9._-]+|\/Users\/[A-Za-z0-9._-]+|[A-Z]:\\\\Users\\\\[A-Za-z0-9._-]+)(?:[\/\\][^\s"'`]+)*/g,
  },
];

export function redactText(input: string, options: RedactionOptions = {}): RedactionResult {
  const rules = [...(options.customRules ?? []), ...BUILT_IN_REDACTION_RULES];
  const findings = collectRedactionFindings(input, rules);

  let cursor = 0;
  let text = "";
  for (const finding of [...findings].sort((left, right) => left.start - right.start)) {
    text += input.slice(cursor, finding.start);
    text += finding.replacement;
    cursor = finding.end;
  }
  text += input.slice(cursor);

  return { text, findings };
}

function collectRedactionFindings(input: string, rules: RedactionRule[]): RedactionFinding[] {
  const findings: RedactionFinding[] = [];

  for (const rule of rules) {
    const regex = toGlobalRegex(rule.pattern);
    for (const match of input.matchAll(regex)) {
      const matched = match[0];
      const start = match.index;
      if (start === undefined || matched.length === 0) {
        continue;
      }

      const end = start + matched.length;
      if (findings.some((finding) => rangesOverlap(start, end, finding.start, finding.end))) {
        continue;
      }

      const label = rule.label ?? rule.id;
      findings.push({
        ruleId: rule.id,
        label,
        start,
        end,
        replacement: `[REDACTED:${label}]`,
      });
    }
  }

  return findings;
}

function toGlobalRegex(pattern: string | RegExp): RegExp {
  if (typeof pattern === "string") {
    return new RegExp(pattern, "g");
  }

  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return new RegExp(pattern.source, flags);
}

function rangesOverlap(leftStart: number, leftEnd: number, rightStart: number, rightEnd: number): boolean {
  return leftStart < rightEnd && rightStart < leftEnd;
}

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
  const errors = parsed.data.artifacts
    .filter((artifact) => !sourceIds.has(artifact.sourceId))
    .map((artifact) => `Artifact ${artifact.id} references missing source ${artifact.sourceId}`);

  const artifactPaths = new Set<string>();
  for (const artifact of parsed.data.artifacts) {
    const pathValidation = validateArtifactPath(artifact.path);
    if (!pathValidation.success) {
      errors.push(`Artifact ${artifact.id} has invalid path ${artifact.path}: ${pathValidation.error}`);
    }

    if (artifactPaths.has(artifact.path)) {
      errors.push(`Artifact ${artifact.id} duplicates artifact path ${artifact.path}`);
    }
    artifactPaths.add(artifact.path);
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, errors: [] };
}

export function validateArtifactPath(path: string): { success: true; normalizedPath: string } | { success: false; error: string } {
  if (path.length === 0) {
    return { success: false, error: "path must not be empty" };
  }
  if (path.includes("\\")) {
    return { success: false, error: "path must use forward slashes" };
  }
  if (path.startsWith("/") || /^[A-Za-z]:/.test(path)) {
    return { success: false, error: "path must be relative" };
  }
  if (!path.startsWith(ARTIFACT_PATH_PREFIX)) {
    return { success: false, error: "path must start with artifacts/" };
  }

  const segments = path.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    return { success: false, error: "path must not contain empty, current, or parent segments" };
  }

  const normalizedPath = pathPosix.normalize(path);
  if (normalizedPath !== path || normalizedPath === "artifacts") {
    return { success: false, error: "path must already be normalized inside artifacts/" };
  }

  return { success: true, normalizedPath };
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
