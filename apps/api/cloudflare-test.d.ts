/// <reference types="@cloudflare/vitest-pool-workers/types" />

// cloudflare:test のアンビエント型を有効化する。テストでのみ使用。
import type { D1Migration } from "@cloudflare/vitest-pool-workers";

declare global {
  namespace Cloudflare {
    // 宣言マージが必要なため interface を使う。
    // oxlint-disable-next-line typescript/consistent-type-definitions
    interface Env {
      DB: D1Database;
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
