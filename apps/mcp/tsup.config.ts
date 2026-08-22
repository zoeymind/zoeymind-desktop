import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  bundle: true,
  noExternal: ["@zoeymind-desktop/document-portal-client"],
  splitting: false,
  sourcemap: true,
  clean: true,
});
