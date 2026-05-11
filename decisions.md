# Context Passport — Decisions Log

## Final decisions
- Project name: Context Passport
- Product category: AI context handoff tool
- Working directory: /home/itolkien/Projects/context-passport
- Repo style: TypeScript monorepo
- CLI: Commander
- Schema: Zod
- Daemon/API: Fastify
- Browser extension: WXT
- Testing: Vitest + Playwright
- Archive format: zip plus manifest.json
- Core direction: local-first, privacy-first, CLI-first

## v0 inputs
- web pages
- GitHub repos
- GitHub issues
- selected text
- manual notes
- screenshots

## v0 outputs
- normalized markdown/text artifacts
- redaction report
- bundle manifest
- exportable archive
- importable archive
- inspectable bundle preview

## Explicitly deferred
- Rust core
- cloud sync
- user accounts
- team sharing
- embeddings/vector DB
- analytics
- agent runtime
- paid features

## Reasoning behind the stack choice
The project needs to ship a real capture/export workflow quickly, and TypeScript keeps the CLI, daemon, and browser extension in one coherent stack.

## Next implementation checkpoint
The next step is repository scaffold + bundle schema implementation.
