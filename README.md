# intervalmap

位置情報インターバル共有アプリ。主催者がセッションを作成し「開示インターバル」と「期限」を設定する。参加者の位置は**継続的に取得されつつ、設定間隔ごとにのみ**グループへ開示され、期限が来ると追跡は完全に停止する。用途は鬼ごっこ・家族の見守り・イベント運営・登山/マラソンの応援など。

- 開発規約とコマンド一覧: [AGENTS.md](AGENTS.md)（CLAUDE.md と同一）
- 環境構築・エミュレータ・実機検証: [CONTRIBUTING.md](CONTRIBUTING.md)
- 企画・決定事項: [docs/handoff.md](docs/handoff.md)

## 構成（pnpm monorepo）

| パッケージ        | 内容                                                  |
| ----------------- | ----------------------------------------------------- |
| `apps/api`        | Cloudflare Workers + Hono + D1 + Drizzle              |
| `apps/mobile`     | Expo（dev-client + EAS Build 前提。**Expo Go 不可**） |
| `packages/shared` | Zod スキーマ / API 型 / 定数（API 境界の単一真実）    |

## クイックスタート

```sh
pnpm install        # Node は .node-version、pnpm 11 固定
pnpm prepare        # Git フック（lefthook）を有効化
pnpm codecheck      # typecheck → lint → format → ls-lint → knip
pnpm test           # 全ワークスペースの Vitest
```

ローカルでの API 起動、エミュレータ・実機での動かし方は [CONTRIBUTING.md](CONTRIBUTING.md) を参照。

## デプロイ

- **API**: `main` への push（`apps/api/**` 変更時）で `deploy-api.yml` が Workers と D1 マイグレーションをデプロイする。GitHub Secrets に `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` が必要。初回のみ `wrangler d1 create intervalmap-db` で発行した ID を `wrangler.jsonc` に設定する。
- **モバイル**: ネイティブ変更を含む場合は `eas.yml` の build ジョブで再ビルド。JS のみの変更は `main` マージ時に EAS Update（OTA）で配信。判断がつかなければ再ビルドする。GitHub Secrets に `EXPO_TOKEN` が必要。

## ステータス

M0（足場）完了、M1（バックグラウンド位置取得）実装済みで実機検証待ち、M2（API と開示ロジック）の中核実装済み。詳細は [AGENTS.md](AGENTS.md) の「現在の進捗」。
