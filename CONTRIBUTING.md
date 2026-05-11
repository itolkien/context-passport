# Contributing

Context Passport is early, local-first infrastructure for AI context handoff. Contributions should keep the project small, inspectable, and privacy-first.

## Development setup

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

## Rules of the road

- No cloud dependency for core workflows.
- No analytics or telemetry.
- No secret-bearing fixture values in tests/docs.
- Add tests before behavior changes.
- Keep bundle artifacts human-inspectable where possible.
- Prefer boring, auditable code over clever abstractions.

## Pull request checklist

- [ ] Tests added or updated.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test` passes.
- [ ] `pnpm build` passes.
- [ ] README/CHANGELOG updated for user-visible changes.
- [ ] No sensitive values in examples, fixtures, or screenshots.

## Good first issues

- Add higher-quality HTML readability extraction.
- Add more redaction rules with safe fixtures.
- Improve extension UX.
- Add model-specific export presets.
- Add bundle diff command.
