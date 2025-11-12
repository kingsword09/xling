import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/**/*.ts"],
  format: ["esm"],
  dts: { oxc: true },
  clean: true,
  outDir: "dist",
  platform: "node",
  target: "node20",
  outExtensions: () => ({ js: ".js" }),
  external: ["@oclif/core", "@iarna/toml", "zod", "cli-table3"],
  shims: true,
});
