# Context Passport — Task Breakdown

## Task 1: Scaffold the monorepo
- create pnpm workspaces
- create base package folders
- add shared scripts
- wire TypeScript config
- add initial test runner setup

## Task 2: Define the bundle schema
- create bundle manifest type
- create source and artifact types
- add schema versioning
- add validation helpers
- add fixture-based tests

## Task 3: Build serialization and hashing
- implement stable JSON serialization
- implement archive manifest writing
- implement hash calculation
- implement bundle integrity checks
- test round-trip stability

## Task 4: Build redaction engine
- implement built-in secret patterns
- support custom patterns
- support preview mode
- support irreversible masking
- test against API keys, emails, paths, tokens

## Task 5: Build CLI commands
- init
- capture
- validate
- export
- import
- inspect
- redact

## Task 6: Build web capture adapter
- capture page title/url
- extract clean text
- extract selected text
- capture screenshot references
- normalize into bundle input

## Task 7: Build GitHub capture adapter
- capture repository metadata
- capture README and file tree summary
- capture issue context
- normalize public HTML pages
- add tests with fixtures

## Task 8: Build browser extension
- extension popup
- content script
- selection capture
- page capture
- screenshot capture
- local handoff to CLI/API

## Task 9: Build local daemon bridge
- local HTTP endpoint
- request validation
- capture queue handling
- error reporting
- CLI fallback path

## Task 10: Build import/export packaging
- zip writer
- zip reader
- manifest writing
- artifact restoration
- human-readable preview

## Task 11: Add integration tests
- capture -> bundle -> export -> import
- redaction -> validation -> export
- extension payload -> daemon -> CLI
- GitHub page capture fixtures

## Task 12: Polish the release
- README
- screenshots
- example bundles
- GitHub topics
- v0.1.0 release tag
