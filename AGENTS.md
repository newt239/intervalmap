# AGENTS.md — intervalmap

位置情報インターバル共有アプリ。主催者がセッションを作り「開示インターバル」と「期限」を設定、参加者の位置は**継続取得・間欠開示**され、期限で追跡が自動停止する。企画の全経緯は [docs/handoff.md](docs/handoff.md) を参照。節番号はこのファイルからも引用する。

## 最重要の不変条件

プライバシー方針の中核でありストア審査対策の要。変更するコードには**必ずテストとコメント**を添えること。

1. **取得は連続・開示は間欠**: クライアントは位置を継続送信するが、他メンバーへの開示は**サーバーが `next_disclosure_at` で権威的に制御**する。クライアント側で送信間隔を絞る方式は採らない。
2. **開示前の位置を返さない**: `GET /sessions/:id/map` は最新 disclosure 時点の各メンバー位置のみ返す。disclosure 以降の点は絶対に返さない。ただし自分自身の現在位置は常に見えてよい。
3. **追跡は必ず有限**: すべての追跡はセッションの `expires_at` で自動終了する。無期限モードは作らない。`ended` 以降の位置アップロードは**サーバー側で拒否**する。
4. **監視しない見守り**: 履歴は短期保持。既定はセッション終了後 `DEFAULT_HISTORY_RETENTION_DAYS` 日で自動削除。定数は `packages/shared/src/constants.ts`。

## リポジトリ構成

pnpm monorepo。

```
apps/api/        Cloudflare Workers + Hono + D1 + Drizzle。Drizzle スキーマもここ
apps/mobile/     Expo。dev-client + EAS Build 前提。Expo Go 不可
packages/shared/ Zod スキーマ + API 型 + 定数。API 境界の単一真実
docs/            handoff.md, ADR, 検証ログ
```

型は **Zod を単一の真実**とし `z.infer` で導出する。DB 行型は `apps/api/src/db/schema.ts` の `$inferSelect` から導出し api 内に閉じる。

## コマンド

| コマンド                                     | 内容                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| `pnpm install`                               | 依存インストール。pnpm 以外は preinstall の only-allow で拒否                   |
| `pnpm codecheck`                             | typecheck → lint → format → ls-lint → knip を直列実行。**コミット前に必ず通す** |
| `pnpm test`                                  | 全ワークスペースの Vitest                                                       |
| `pnpm lint` / `pnpm lint:fix`                | oxlint。type-aware                                                              |
| `pnpm format` / `pnpm format:fix`            | oxfmt                                                                           |
| `pnpm --filter @intervalmap/api dev`         | Worker ローカル起動                                                             |
| `pnpm --filter @intervalmap/api db:generate` | Drizzle マイグレーション SQL 生成                                               |
| `pnpm --filter @intervalmap/mobile start`    | Expo dev サーバ                                                                 |

Git フックは lefthook。`pnpm prepare` で install。pre-commit は lint/format/ls-lint、pre-push は codecheck。

## コード規約

newt239/next-template を踏襲する。

- **ESLint / Prettier は使わない**。oxlint + oxfmt に統一。
- **依存は完全固定**。`^` や `~` を付けない。`saveExact: true`。パッケージマネージャは pnpm 固定。
- Node.js は `.node-version` で固定し、CI もこれを参照する。
- TypeScript strict。`noUncheckedIndexedAccess` 等も有効。`interface` ではなく `type` を使う。
- ファイル命名は kebab-case。`.md` は SCREAMING_SNAKE_CASE も可、`apps/api/drizzle` の `.sql` は snake_case、expo-router の特殊名 `_layout` / `[code]` / `+not-found` は許可。ls-lint で強制。
- 時刻はすべて epoch ミリ秒で扱い、端末時計に依存させない。カウントダウンは `next_disclosure_at` 基準。

## コメント・コミット規約

- コメントは原則1行以内で書き、必要最低限に留める。
- コメントに括弧書きを使わない。
- コミットメッセージは prefix を付け、原則1行以内に収める。prefix は `feat:` `fix:` `chore:` `docs:` `ci:` `refactor:` `test:` 等。
- コミットメッセージに括弧書きを使わない。

## モバイルの重要注意

- **Expo Go では動かない**。必ず expo-dev-client + EAS Build を使う。
- 位置取得層は `apps/mobile/src/features/location/` の `LocationTracker` インターフェースで抽象化済み。Transistorsoft 版への差し替えを想定。
- **ネイティブ設定を変更したら EAS 再ビルドが必要**。`app.config.ts` plugins / Info.plist / AndroidManifest。PR 説明に明記すること。
- Android は `ACCESS_BACKGROUND_LOCATION` を宣言せずフォアグラウンドサービスのみで検証中。`isAndroidBackgroundLocationEnabled: false`。

## 現在の進捗

- **M0 足場完了**。次の最優先は M1 のバックグラウンド位置の実機スパイク。結果は `docs/spike-location.md` に残す。
- 開示ロジック・期限判定・無応答アラートの本実装とユニットテストは M2。
- 不明点は [docs/handoff.md](docs/handoff.md) の該当セクション番号を引用して質問すること。
