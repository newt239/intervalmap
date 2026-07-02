# AGENTS.md — intervalmap

位置情報インターバル共有アプリ。主催者がセッションを作り「開示インターバル」と「期限」を設定する。参加者の位置は**継続取得・間欠開示**され、期限で追跡が自動停止する。

- 企画と決定事項: [docs/handoff.md](docs/handoff.md)（節番号はこのファイルからも引用する）
- 環境構築・エミュレータ・実機検証: [CONTRIBUTING.md](CONTRIBUTING.md)

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

### 抽象化の抑制

過度な抽象化は処理の流れを追いづらくする。

- 関数・定数・変数を共通化してよいのは、**3回以上使われ、かつ共通化する意義が大きい**場合のみ。それ以外は使用箇所のファイルに置くか、呼び出し側に直接書く。
- **実装が5行に満たない関数は本当に必要か再考する**。単純な式や単発のラッパーはインラインにする。
- 例外は不変条件を担うロジック。重複させると危険なもの（開示時点のフィルタ等）は使用回数が少なくても1箇所に集約してよい。

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

- **M0 足場完了**。
- **M1 実装完了・実機検証待ち**: expo-location + expo-task-manager で `LocationTracker` を本実装済み。選定理由は [docs/adr/0001-background-location.md](docs/adr/0001-background-location.md)。実機スパイクの結果は [docs/spike-location.md](docs/spike-location.md) に記録する。
- **M2 の中核実装済み**: 匿名デバイス認証、セッション作成/参加/終了、位置バッチアップロード、開示ビュー、参加中セッション一覧 `GET /sessions`、移動履歴 `GET /sessions/:id/history`、毎分 Cron の開示・期限処理。不変条件のユニットテスト・統合テストあり。無応答アラートと開示プッシュは未実装。履歴は開示済みスナップショットの系列のみ返す。
- モバイルはネイティブボトムタブ（ホーム・セッション一覧）で、セッション作成→参加→地図表示（開示カウントダウン・移動履歴ポリライン付き）まで動線あり。
- UI は `apps/mobile/src/components/` の OS 別コンポーネントに統一済み。コンポーネントごとにディレクトリを持ち、`index.ios.tsx` が @expo/ui/swift-ui で HIG に、`index.android.tsx` が @expo/ui/jetpack-compose で Material 3 に合わせ、共有 Props は各ディレクトリの `types.ts` に置く。設定タブはメニューのみで、各設定は `app/settings/` の詳細ページで行う。実機での見た目の磨きは M6。
- 不明点は [docs/handoff.md](docs/handoff.md) の該当セクション番号を引用して質問すること。
