import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/**/*.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  outDir: "dist",
  platform: "node",
  target: "node18",
  outExtensions: () => ({ js: ".js" }),
  external: ["@oclif/core", "@iarna/toml", "zod", "cli-table3"],
  shims: true, // 确保 __dirname 和 __filename 可用
});
