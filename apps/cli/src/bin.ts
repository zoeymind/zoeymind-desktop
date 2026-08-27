#!/usr/bin/env node
import { main } from "./index.js";

void main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Document Portal request failed"}\n`,
  );
  process.exitCode = 1;
});
