# Context Passport — Implementation Plan

> Goal: Build a local-first, privacy-first AI context handoff tool that captures web pages, GitHub repos/issues, notes, text selections, files, and screenshots into a shareable bundle.

## Final product shape
The project will ship as a TypeScript monorepo with:
- a CLI as the source of truth
- a browser extension for capture
- a local daemon for communication when needed
- a shared bundle schema and redaction pipeline
- import/export/inspect commands

## Locked decisions
- Stack: TypeScript monorepo
- CLI: Commander
- Validation: Zod
- API: Fastify
- Extension: WXT
- Testing: Vitest + Playwright
- Archive: zip + manifest.json
- First release: local-first, no accounts, no cloud

## v0 feature set
Must-have:
- capture web pages
- capture GitHub repo pages
- capture GitHub issue pages
- capture selected text
- capture manual notes
- capture screenshots
- normalize content into markdown/text artifacts
- redact secrets and sensitive identifiers
- validate a bundle
- export a bundle
- import a bundle
- inspect a bundle

Nice-to-have if time remains:
- diff between two bundles
- bundle quality score
- GitHub issue draft generator
- model-specific handoff presets

## File layout to create
- `packages/core/`
- `packages/cli/`
- `packages/daemon/`
- `packages/extension/`
- `packages/shared/`
- `docs/`
- `examples/`
- `tests/`

## Detailed implementation phases

### Phase 1: Repository scaffold
1. Initialize the monorepo.
2. Add workspace config and shared tooling.
3. Add lint/test/typecheck scripts.
4. Create package boundaries.
5. Add a minimal README placeholder.

### Phase 2: Core bundle model
1. Define bundle schema in `packages/shared`.
2. Implement validation.
3. Implement serialization/deserialization.
4. Implement integrity hashing.
5. Add round-trip tests.

### Phase 3: Redaction engine
1. Build pattern-based secret detection.
2. Add preview output.
3. Add irreversible masking.
4. Add custom rules support.
5. Add redaction tests with realistic fixtures.

### Phase 4: CLI commands
1. `passport init`
2. `passport capture`
3. `passport validate`
4. `passport export`
5. `passport import`
6. `passport inspect`
7. `passport redact`

### Phase 5: Web and GitHub adapters
1. Web page extraction.
2. GitHub repo parsing from public HTML.
3. GitHub issue parsing from public HTML.
4. Selection/text capture.
5. Manual note capture.

### Phase 6: Bundle packaging
1. Create zip archive output.
2. Store manifest and artifacts.
3. Ensure import recreates the bundle.
4. Add a human-readable preview command.
5. Verify bundle integrity after round-trip.

### Phase 7: Browser extension
1. Add page capture UI.
2. Add selection capture UI.
3. Add screenshot capture UI.
4. Send capture payload to local API or file bridge.
5. Add minimal polish so it feels like a real product.

### Phase 8: Quality gates
1. Unit tests for all core logic.
2. Playwright tests for extension flows.
3. Integration tests for capture -> bundle -> export -> import.
4. Security tests for redaction.
5. Add schema migration test coverage.

### Phase 9: Documentation and release
1. Write a strong README.
2. Add example bundles.
3. Add screenshots/GIFs.
4. Add GitHub topics.
5. Tag v0.1.0.

## Acceptance criteria
The project is done when:
- a user can capture a page or repo in one action
- the bundle can be validated and imported locally
- sensitive data is masked before sharing
- the README explains the value instantly
- the extension and CLI both work without cloud dependencies

## Explicit scope guardrails
Do not add:
- cloud sync
- accounts
- analytics
- embeddings
- vector search
- agent runtime
- paid features
- team collaboration
unless they are required for v0 to function.

## Immediate next build order
1. scaffold monorepo
2. define bundle schema
3. build redaction
4. build CLI
5. build web adapter
6. build extension
7. add integration tests
