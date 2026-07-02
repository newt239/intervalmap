import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// vitest-pool-workers v0.17 以降はプラグイン形式。旧 defineWorkersConfig は廃止。
export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
  test: {
    include: ["src/**/*.{spec,test}.ts", "tests/**/*.{spec,test}.ts"],
  },
});
