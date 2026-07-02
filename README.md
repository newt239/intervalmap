# intervalmap

位置情報インターバル共有アプリ。主催者がセッションを作成し「開示インターバル」と「期限」を設定、参加者の位置は**継続的に取得されつつ、設定間隔ごとにのみ**グループへ開示される。期限が来ると追跡は完全に停止する。用途は鬼ごっこ・家族の見守り・イベント運営・登山/マラソンの応援など。

企画・技術選定の全経緯は [docs/handoff.md](docs/handoff.md)、開発者向けの規約は [CLAUDE.md](CLAUDE.md) を参照。

## 構成（pnpm monorepo）

| パッケージ        | 内容                                                  |
| ----------------- | ----------------------------------------------------- |
| `apps/api`        | Cloudflare Workers + Hono + D1 + Drizzle              |
| `apps/mobile`     | Expo（dev-client + EAS Build 前提。**Expo Go 不可**） |
| `packages/shared` | Zod スキーマ / API 型 / 定数（API 境界の単一真実）    |

## セットアップ

```sh
# Node 24+ / pnpm 11+ が前提（pnpm 以外は preinstall で拒否される）
pnpm install
pnpm prepare        # lefthook（Git フック）を有効化
pnpm codecheck      # typecheck → lint → format → ls-lint → knip
pnpm test           # 全ワークスペースの Vitest
```

## API（apps/api）

```sh
pnpm --filter @intervalmap/api dev          # wrangler dev でローカル起動
# 初回のみ: D1 を作成し、wrangler.jsonc の database_id を差し替える
#   pnpm --filter @intervalmap/api exec wrangler d1 create intervalmap-db
pnpm --filter @intervalmap/api db:generate  # スキーマ変更後にマイグレーション SQL 生成
pnpm --filter @intervalmap/api db:migrate:local
```

デプロイは `main` への push（`apps/api/**` 変更時）で `deploy-api.yml` が実行。GitHub Secrets に `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` が必要。

## モバイル（apps/mobile）

**Expo Go では動作しない**（バックグラウンド位置情報のため）。開発クライアントを EAS Build で作成して使う。

```sh
# 開発ビルド（実機/シミュレータ用の dev client）
pnpm --filter @intervalmap/mobile exec eas build --profile development
pnpm --filter @intervalmap/mobile start     # Metro を dev-client モードで起動
```

### EAS Build と EAS Update の運用差分

- **ネイティブ変更を含む PR**（`app.config.ts` の plugins、パーミッション、ネイティブ依存の追加/更新）は、`eas.yml` の **build** ジョブ（タグ push または手動）で再ビルドが必要。
- **JS のみの変更**は `main` マージ時の **update** ジョブが **EAS Update（OTA）** で配信する。再ビルド不要。
- どちらに該当するか判断がつかない場合はネイティブ変更として扱い、再ビルドする。

GitHub Secrets に `EXPO_TOKEN` が必要。

## ステータス

M0（足場）完了。次は M1（バックグラウンド位置の実機スパイク、最優先）。詳細は [docs/handoff.md](docs/handoff.md) §8 マイルストーン。
