import { defineConfig } from "drizzle-kit";

// drizzle-kit 設定。db:generate で SQL を生成し wrangler d1 migrations apply で適用する。
export default defineConfig({
  dialect: "sqlite",
  driver: "d1-http",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
