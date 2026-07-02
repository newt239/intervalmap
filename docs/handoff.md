# 位置情報インターバル共有アプリ 開発ハンドオフドキュメント

企画・技術選定フェーズの決定事項の記録。ここに書かれたことは議論済みなので、原則として再検討しない。「§9 未決事項」のみ実装中に判断・提案する。実装の現在地は [AGENTS.md](../AGENTS.md) の「現在の進捗」を参照。

## 1. プロダクト概要

主催者がセッションを作成し「開示インターバル」と「期限」を設定する。参加者は招待リンク/QRで参加し、位置はバックグラウンドで記録され、**設定インターバルごとにのみ**グループへ公開される。期限が来ると追跡は完全に停止する。用途は鬼ごっこ、家族の見守り、イベント運営、マラソン・登山の応援など。

設計思想（全実装に通底させる）:

- **取得は連続、開示は間欠**: 開示タイミングはサーバーが権威的に制御する。クライアント側で送信間隔を絞ると時計ズレ・改ざん・リロード時の即時漏洩が起きるため採らない。
- **追跡は必ず有限**: `expires_at` で自動終了。無期限モードは作らない。プライバシー方針であると同時にストア審査対策の中核。
- **監視しない見守り**: 履歴は短期保持（終了後30日で自動削除）。精度段階（正確/おおまか）の余地をスキーマに残す。

## 2. 確定済みの技術スタック

| レイヤー     | 選定                                     | 備考                                                            |
| ------------ | ---------------------------------------- | --------------------------------------------------------------- |
| モバイル     | Expo + Expo Router                       | **Expo Go 不可**。expo-dev-client + EAS Build 前提              |
| UI           | Expo UI（`@expo/ui`）                    | iOS: SwiftUI / Android: Jetpack Compose を実レンダリング        |
| 地図         | expo-maps                                | iOS: Apple Maps / Android: Google Maps                          |
| 位置情報     | expo-location + expo-task-manager        | 選定比較は [adr/0001](adr/0001-background-location.md)          |
| プッシュ     | expo-notifications + Expo Push Service   | APNs/FCM の差異を吸収                                           |
| バックエンド | Cloudflare Workers + Hono                |                                                                 |
| DB           | Cloudflare D1 + Drizzle ORM              |                                                                 |
| スケジューラ | Cloudflare Cron Triggers（毎分）+ Queues | 開示判定・期限終了・無応答アラート                              |
| リアルタイム | **使わない**                             | 開示が間欠なので「次回開示時刻へのポーリング+プッシュ」で足りる |
| 共有コード   | packages/shared                          | Zod スキーマ + API 型                                           |

## 3. リポジトリ構成（pnpm monorepo）

```
apps/mobile/       Expo アプリ
apps/api/          Cloudflare Workers (Hono)
packages/shared/   Zod スキーマ、API 型、定数
docs/              このファイル、ADR、検証ログ
```

ルートに CLAUDE.md（AGENTS.md への symlink）、lefthook.yml、oxc 系設定、pnpm-workspace.yaml。

## 4. ツールチェーンと規約

newt239/next-template を monorepo に拡張して適用。**ESLint / Prettier は導入しない**。

- リンタ: oxlint（type-aware）。フォーマッタ: oxfmt。加えて ls-lint（ファイル命名）と knip（未使用コード）。
- Git フック: lefthook。pre-commit で lint/format、pre-push で codecheck。
- 集約スクリプト: ルートの `codecheck` が typecheck → lint → format → ls-lint → knip を直列実行。
- テスト: Vitest。api は `@cloudflare/vitest-pool-workers`。**開示ロジックと期限判定は必ずテストを書く**。mobile の E2E は当面スコープ外（将来 Maestro を検討）。
- 依存は完全固定（`^` `~` なし）。`preinstall: only-allow pnpm`。型は strict で Zod を単一の真実とする。

CI（GitHub Actions）: ci.yml（codecheck + test）、deploy-api.yml（main push で Workers + D1 マイグレーション）、eas.yml（build は手動/タグ、EAS Update は main マージ時）、Dependabot。

## 5. データモデル

Drizzle スキーマは apps/api 配下（実体は `apps/api/src/db/schema.ts`）。

```
users            id, display_name, auth_token, created_at
push_tokens      id, user_id, expo_push_token, platform, updated_at
sessions         id, owner_id, title, invite_code, interval_sec,
                 starts_at, expires_at, precision, status, next_disclosure_at, created_at
memberships      id, session_id, user_id, role, sharing_enabled, last_uploaded_at, joined_at
location_points  id, session_id, membership_id, captured_at, lat, lng,
                 accuracy_m, battery, uploaded_at
disclosures      id, session_id, disclosed_at
alerts           id, session_id, membership_id, type, fired_at
```

開示ロジックの要件（最重要のドメインロジック。ユニットテスト必須）:

- Cron（毎分）が `status='active' AND next_disclosure_at <= now` のセッションに disclosure を作成し、`next_disclosure_at` をインターバル分進め、参加者へプッシュをファンアウトする。
- 参加者向け API は「最新 disclosure 時点の各メンバー位置」のみ返す。disclosure 以降の点は絶対に返さない。**自分自身の現在位置は常に見えてよい**。
- `expires_at <= now` で `status='ended'` に更新。ended 以降のアップロードは**サーバー側で拒否**する。
- 無応答アラート: `last_uploaded_at` が `interval_sec × 3` を超えたメンバーがいたら主催者へプッシュ。連続発火はクールダウンさせる。

## 6. API 設計（Hono）

認証は匿名デバイス認証（初回起動で user 作成、Bearer トークン発行）で開始。

```
POST   /users                  匿名ユーザー登録（トークン発行）
POST   /sessions               セッション作成（title, interval_sec, duration_sec, precision）
GET    /sessions               参加中セッション一覧（自分の membership 付き）
POST   /sessions/join          invite_code で参加
GET    /sessions/:id           セッション詳細 + メンバー一覧
POST   /sessions/:id/end       主催者による即時終了
POST   /sessions/:id/locations 位置のバッチアップロード
GET    /sessions/:id/map       最新開示時点の全メンバー位置 + next_disclosure_at
GET    /sessions/:id/history   移動履歴（開示済みスナップショットの系列のみ。リプレイ用）
PUT    /me/push-token          Expo Push token 登録（未実装）
```

`GET /sessions/:id/map` が `next_disclosure_at` と `serverNow` を返すため、クライアントは次回開示時刻+αに1回だけ再フェッチすればよい。

## 7. モバイル実装方針

- **位置取得層の抽象化**: `apps/mobile/src/features/location/` の `LocationTracker` インターフェース（`start` / `stop` / `getStatus` / `restore`）に expo-location 実装を隠す。Transistorsoft への差し替えのため。
- **expo-location の要点**: `startLocationUpdatesAsync` + task-manager。取得は5〜15秒間隔、`deferredUpdatesInterval` で開示インターバルに寄せて OS バッチング。アップロードはバッチ。
  - Android: 位置情報タイプのフォアグラウンドサービス（常駐通知）。**アプリ前面中にサービスを開始**することで `ACCESS_BACKGROUND_LOCATION` を宣言せずに済ませる（Google Play の背景位置審査の回避）。
  - iOS: When In Use → Always の2段階昇格。`showsBackgroundLocationIndicator: true`。purpose string に有限性を明記。
  - 権限昇格の前に**理由説明の自前モーダル**を必ず挟む。
- **UI**: フォーム・リスト・シート系は `@expo/ui` を第一選択。地図上のオーバーレイ（カウントダウン、メンバーチップ）は RN プリミティブで自由に作る。カウントダウンは `next_disclosure_at` 基準で端末時計に依存させない。
- **招待導線**: ディープリンク + ユニバーサルリンクで `https://<domain>/join/<invite_code>`。QR は同 URL。未インストール時の誘導は Web の中継ページ1枚。

## 8. マイルストーン

- **M0 足場**: monorepo、ツールチェーン、CI、Hello World デプロイ。**完了**。
- **M1 バックグラウンド位置検証スパイク（最優先）**: iOS/Android 実機で継続アップロード・期限自動停止・電池消費を検証。チェックリストと記録は [spike-location.md](spike-location.md)。結果次第で expo-location 続行か Transistorsoft 移行かを判断する。
- **M2 スキーマ + API + 開示ロジック**（§5・§6。テスト込み）
- **M3 セッションのライフサイクル**（作成→招待→参加→開始→終了、権限オンボーディング）
- **M4 地図と開示体験**（expo-maps、開示プッシュ、カウントダウン、履歴リプレイ）
- **M5 見守り機能**（無応答アラート、終了通知、履歴の自動削除）
- **M6 磨き**（Expo UI 仕上げ、空状態、エラーハンドリング、審査準備）

## 9. 未決事項（実装中に提案してほしいこと）

1. **プロダクト名 / Bundle ID**: 未定。コードネーム `intervalmap` でよい。
2. **認証**: 匿名デバイス認証で開始。機種変更時の引き継ぎ方式（better-auth かリンクコード方式か）は提案がほしい。
3. **D1 のレイテンシ**: 位置書き込みが高頻度なため、実測して問題があれば KV/Queues バッファリングを提案。
4. **expo-maps の成熟度**: 要件（複数マーカー、カスタムマーカー、追従）に不足があれば react-native-maps への切り替えを提案してよい。
5. **鬼ごっこモード**: 役職による可視性の非対称は将来対応。MVP は全員対等で、memberships の role 列に余地だけ残す。

## 10. 作業指示

- コミット前に必ず `pnpm codecheck` を通す。
- プライバシー不変条件（開示前の位置を返さない、期限後に追跡しない、履歴の自動削除）を変更するコードには必ずテストとコメントを添える。
- ネイティブ設定を変更した場合は EAS 再ビルドが必要である旨を PR 説明に明記する。
- 不明点はこのドキュメントの該当セクション番号を引用して質問する。
