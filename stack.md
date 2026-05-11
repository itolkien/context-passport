# Context Passport — Tech Stack Decision

## Chosen stack
- Language: TypeScript
- Package manager: pnpm
- Repo layout: monorepo
- CLI: Node.js + Commander
- Schema validation: Zod
- Local daemon/API: Fastify
- Browser extension: WXT (Manifest V3)
- Tests: Vitest + Playwright
- Bundling: tsup for packages, Vite for extension app shell
- Archive format: zip with a manifest JSON
- HTML parsing: Cheerio
- Screenshot/image handling: browser capture + optional local image processing later

## Why this stack
- One language across CLI, daemon, and extension keeps the project shippable
- TypeScript reduces friction for browser extension work
- WXT gives a clean extension workflow and modern MV3 support
- Zod keeps the bundle schema explicit and versioned
- Fastify is mature enough for a small local API without adding complexity
- Vitest + Playwright covers unit tests and real browser flows

## Architectural decision
We are not building a Rust core for v0.

Reason:
- the product value is in shipping the capture + bundle workflow quickly
- the extension and CLI already benefit from TypeScript
- a Rust core would slow the first public release without enough upside yet

## Local runtime model
- CLI does the heavy lifting for bundle validation/export/import
- extension captures page context and forwards it locally
- daemon is optional in v0, but the codebase should allow it
- if the daemon is not running, the CLI can still work on local files directly

## Native dependencies to avoid in v0
- no GPU-specific runtime
- no vector DB
- no OCR service dependency unless optional
- no auth system
- no cloud backend

## Future escape hatches
If performance or file-processing complexity grows later, we can introduce:
- a Rust worker for archive/index processing
- optional OCR microservice
- optional desktop shell

For v0, none of those are needed.
