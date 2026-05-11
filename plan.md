# Context Passport — Master Plan

> Goal: Build a local-first, privacy-first tool that turns web pages, GitHub repos/issues, chats, screenshots, files, and notes into a shareable AI context bundle.

## Why this exists
AI work is still too manual around context transfer:
- copying the right text is annoying
- screenshots and files get lost
- secrets leak into prompts
- moving context between tools/models is messy
- people need a clean way to hand off context to an AI or a teammate

## Product thesis
Not another prompt editor.
Not another eval dashboard.
This is a context handoff layer.

If it works, users should feel:
- “Why didn’t this exist already?”
- “This saved me 10 minutes in one shot.”
- “I can safely share this with another model or person.”

## Core principles
1. Local-first by default
2. Privacy-first redaction before export
3. One bundle format for many sources
4. Import/export must round-trip cleanly
5. CLI is the source of truth
6. Browser extension is a capture helper, not the core logic
7. Versioned schema from day one
8. Small core, pluggable adapters

## v0 scope
Inputs:
- web page
- GitHub repo
- GitHub issue
- selected text
- manual note
- screenshot

Outputs:
- normalized markdown
- bundle manifest
- redaction report
- validation status
- exportable archive

## Out of scope for v0
- cloud sync
- user accounts
- team workspaces
- embeddings/vector search
- long-term memory
- paid features
- agent orchestration
- analytics dashboard

## Success criteria
A v0 is good enough if:
- a bundle can be created in under 30 seconds
- export/import works without losing structure
- secrets are masked by default
- the bundle is readable by humans and machines
- the README demo makes the value obvious in under 1 minute

## Milestone plan
### Milestone 1: Foundation
- define bundle schema
- create CLI skeleton
- create validation + serialization
- add tests for round-trip integrity

### Milestone 2: Capture adapters
- web page capture
- GitHub repo capture
- GitHub issue capture
- selection/manual note capture

### Milestone 3: Privacy layer
- redaction engine
- preview mode
- custom rules
- safety tests

### Milestone 4: Packaging
- bundle export to zip/single archive
- bundle import
- human-readable preview
- integrity hashes

### Milestone 5: Browser extension
- capture current page
- capture selected text
- send data to local daemon/CLI
- minimal polished UX

### Milestone 6: Polish + release
- README
- screenshots/GIF
- examples
- release tags
- GitHub topics

## Definition of done
The project is ready for public release when:
- CLI commands are stable
- bundle schema is versioned
- redaction is reliable
- extension capture works
- tests cover the main flows
- README explains the product in one glance

## Working rule
Do not add broad “future-proof” features unless they are needed to make capture, redaction, export, or import better now.
