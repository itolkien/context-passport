# Context Passport — Architecture

## High-level shape
The project should be split into a small core plus adapters:

- core: bundle schema, validation, serialization, hashing, redaction
- adapters: web, GitHub repo, GitHub issue, text selection, screenshots, files
- cli: capture, validate, export, import, inspect
- daemon: optional local service for browser extension integration
- extension: lightweight capture UI

## Data flow
1. User captures a source
2. Adapter extracts raw content and metadata
3. Core normalizes content into bundle entries
4. Redaction runs before export
5. Validator checks schema and integrity
6. Export writes a portable archive
7. Import reconstructs readable context

## Bundle contents
A bundle should include:
- manifest.json
- raw or normalized text files
- optional screenshots or attachments
- redaction metadata
- hashes
- schema version
- source metadata

## Core abstractions
### Source
Represents where the context came from.
Examples:
- web page
- github repo
- github issue
- manual note
- screenshot

### Artifact
Represents derived content.
Examples:
- markdown
- plain text
- screenshot image
- OCR text
- diff patch

### Bundle
The final package that can be exported, shared, imported, and validated.

## Important architectural decisions
- CLI owns final bundle creation
- extension only captures and forwards data
- schema versioning is mandatory from day one
- redaction is a first-class pipeline stage
- all adapters must be replaceable without changing bundle format

## Recommended implementation order
1. bundle schema
2. serializer/deserializer
3. validator
4. redaction engine
5. CLI commands
6. web adapter
7. GitHub adapter
8. screenshot adapter
9. extension bridge
10. polish and tests

## Failure modes to guard against
- leaked secrets in exports
- bundle corruption after import/export
- adapter-specific format leaks into core
- too much logic in the browser extension
- schema drift without version handling
