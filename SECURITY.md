# Security Policy

Context Passport is designed to reduce accidental context leakage. Please report issues that can leak secrets, escape bundle directories, or corrupt exported archives.

## Supported versions

Only the latest unreleased `main` branch is currently supported.

## Reporting a vulnerability

Open a private security advisory on GitHub if available. If not, open a minimal public issue that describes the affected area without including exploit payloads or real secrets.

## Security expectations

- Redaction findings must not include the matched secret value.
- Bundle import/export must reject path traversal.
- Examples and tests must use fake values only.
- Local daemon endpoints must stay bound to `127.0.0.1` by default.
