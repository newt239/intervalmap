import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import path from "node:path";
import { defineConfig } from "vitest/config";

// vitest-pool-workers v0.17 以降はプラグイン形式。旧 defineWorkersConfig は廃止。
// D1 マイグレーションを読み込み、setup ファイルでテスト用 DB に適用する。
export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, "drizzle"));
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
      }),
    ],
    test: {
      include: ["src/**/*.{spec,test}.ts", "tests/**/*.{spec,test}.ts"],
      setupFiles: ["./tests/apply-migrations.ts"],
    },
  };
});
