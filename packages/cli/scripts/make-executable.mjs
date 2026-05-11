import { chmodSync, existsSync } from "node:fs";

const file = new URL("../dist/index.js", import.meta.url);
if (existsSync(file)) {
  chmodSync(file, 0o755);
}
