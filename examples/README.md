# Examples

- `demo-bundle/`: redacted demo bundle directory.
- `demo-bundle.cpb.zip`: portable ZIP archive form of the same bundle.

Run:

```bash
pnpm passport inspect examples/demo-bundle
pnpm passport validate examples/demo-bundle
pnpm passport import examples/demo-bundle.cpb.zip --out /tmp/context-passport-demo
```
