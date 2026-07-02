import { applyD1Migrations, env } from "cloudflare:test";

// テスト用 D1 に Drizzle 生成のマイグレーションを適用する。
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
