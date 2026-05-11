# Context Passport — Scope

## In scope
- capture context from a web page
- capture context from GitHub repos and issues
- capture selected text and notes
- capture screenshots
- normalize everything into one bundle format
- redact secrets and sensitive text
- export/import bundles locally
- validate bundles
- inspect bundle contents

## Later, after v0
- browser extension polish
- better screenshot OCR
- model-specific handoff presets
- bundle diffing
- multi-bundle merge
- GitHub issue generation from bundle
- signed bundles
- team sharing
- cloud sync

## Explicitly out of scope for now
- authentication
- account management
- multi-user collaboration
- payment/subscriptions
- online storage
- vector database
- agent runtime
- knowledge graph
- heavy UI framework

## Design constraints
- local-first
- privacy-first
- deterministic output when possible
- small dependency footprint
- simple install path
- clean CLI-first workflow

## Non-goals
- replacing ChatGPT/Claude/Codex
- becoming an observability product
- becoming a prompt marketplace
- building a general note-taking app
