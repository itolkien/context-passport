# Context Passport — Roadmap

## Phase 0: Decide the shape
- lock the project name
- lock the bundle format
- lock the v0 scope
- choose the implementation language and packaging style

## Phase 1: Core foundation
- create project scaffold
- add bundle schema
- add serialize/deserialize
- add validator
- add redaction skeleton
- add unit tests

## Phase 2: Capture from real sources
- web page adapter
- GitHub repo adapter
- GitHub issue adapter
- manual note adapter
- screenshot adapter

## Phase 3: Export/import workflows
- archive export
- archive import
- inspect bundle command
- preview output command
- round-trip tests

## Phase 4: Browser capture layer
- browser extension prototype
- selection capture
- page capture
- screenshot capture
- send-to-local flow

## Phase 5: Quality and safety
- secret masking tests
- false-positive redaction review
- bundle integrity hashes
- schema migration test
- cleanup and docs

## Phase 6: Public release polish
- README with screenshots
- example bundles
- demo gif
- GitHub topics
- initial release tag

## Release rule
Do not call it “done” until:
- capture works
- export/import works
- redaction works
- bundle inspection works
- docs make the value obvious
