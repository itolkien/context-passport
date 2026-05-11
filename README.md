# Context Passport

Local-first, privacy-first AI context handoff bundles.

Context Passport captures web pages, GitHub repos/issues, selected text, notes, files, and screenshots into a portable bundle that can be safely shared with another AI tool or teammate.

## Why

AI workflows still depend on messy copy-paste. Context Passport turns context into a versioned, redacted, inspectable artifact.

## Status

Early scaffold. See:

- `plan.md`
- `implementation-plan.md`
- `tasks.md`
- `architecture.md`

## Planned CLI

```bash
passport capture --url https://github.com/example/repo
passport validate ./bundle.ctxpack
passport inspect ./bundle.ctxpack
passport export ./bundle-dir
passport import ./bundle.ctxpack
```

## License

MIT
