# Changelog

All notable changes to Context Passport will be documented in this file.

## 0.2.0 - 2026-05-12

### Added

- Guided interactive wizard when running `passport` with no subcommand.
- Wizard flow for manual note, local file, and URL capture.
- Wizard privacy check with redaction preview/apply prompts.
- Wizard export flow for newly created bundles and existing bundle directories.
- Demo-friendly terminal transcript in the README.
- Regression tests for wizard side effects and user-facing transcript markers.
- Non-TTY stdin support so wizard flows can be smoke-tested with piped input.
- Overwrite warning for existing output directories in the wizard to prevent accidental data loss.
- Overwrite warning for existing archive paths in the wizard export flow.
- Publish-safe package whitelists and tarball install smoke coverage for the CLI/core/shared packages.
- Expanded built-in redaction patterns for AWS access keys, AWS secret assignments, Stripe keys, Anthropic keys, Google API keys, JWTs, and PEM private keys.

### Changed

- CLI package version updated to `0.2.0`.
- README now leads with the guided workflow while keeping power-user subcommands documented.

## 0.1.0 - 2026-05-11

### Added

- Local-first Context Passport bundle schema.
- CLI commands for note, URL, and local file capture.
- CLI commands for validate, inspect, redact, export, and import.
- Pattern-based secret redaction with preview/apply modes.
- Manifest-field redaction to prevent URL/title metadata leaks.
- Path traversal protection for bundle artifact reads/writes.
- Local daemon endpoint for browser extension capture.
- WXT browser extension popup for active page/selection capture.
- Portable ZIP bundle archive support (`.cpb.zip`).
- Example redacted bundle and terminal demo SVG.
- GitHub Actions CI for typecheck, tests, and build.
