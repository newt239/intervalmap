# 位置情報インターバル共有アプリ 開発ハンドオフドキュメント

このドキュメントは、企画・技術選定フェーズの結論をClaude Codeへ引き継ぐためのものです。ここに書かれた決定事項は議論済みなので、原則として再検討せずに実装を進めてください。「未決事項」セクションの項目のみ、実装中に判断・提案してください。

---

## 1. プロダクト概要

**コンセプト**: 主催者がグループ（セッション）を作成し、「位置情報が公開されるインターバル」と「期限」を設定する。参加者は招待リンク/QRで参加し、セッション中は位置がバックグラウンドで記録され、**設定されたインターバルごとにのみ**グループに公開される。期限が来ると追跡は完全に停止する。

**用途**: 友人との鬼ごっこ（逃走中型の間欠位置公開）、家族の見守り・死活監視、イベント運営、マラソン・登山の応援など。

**設計思想（重要・全実装に通底させること）**:

- **取得は連続、開示は間欠**: クライアントは位置を継続的にサーバーへ送るが、他メンバーへの開示タイミングはサーバーが権威的に制御する。クライアント側で送信間隔を絞る方式は採らない（時計ズレ・改ざん・リロード時の即時漏洩の問題があるため）。
- **追跡は必ず有限**: すべての追跡はセッションの `expires_at` で自動終了する。無期限の常時追跡モードは作らない。これはプライバシー方針であると同時に、App Store / Google Play 審査対策の中核でもある。
- **監視しない見守り**: 位置履歴の保持は短期（デフォルト: セッション終了後30日で自動削除）。精度段階の選択（正確 / おおまか）をセッション設定に持てる余地をスキーマに残す。

## 2. 確定済みの技術スタック

| レイヤー         | 選定                                                | 備考                                                                                                                                                 |
| ---------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| モバイル         | Expo（React Native）、Expo Router                   | **Expo Go不可**。最初から expo-dev-client + EAS Build 前提で構成する（バックグラウンド位置情報がExpo Goで動作しないため）                            |
| UI               | **Expo UI（`@expo/ui`、SDK 56で安定版）**           | iOSはSwiftUI、AndroidはJetpack Composeを実レンダリング。「各OSのデザインシステムに合わせる」という要件の実現手段                                     |
| 地図             | expo-maps（iOS: Apple Maps / Android: Google Maps） | OSネイティブ方針と一貫させる                                                                                                                         |
| 位置情報         | expo-location + expo-task-manager                   | 信頼性が問題になった場合の差し替え先として react-native-background-geolocation（Transistorsoft）を想定し、**位置取得層は必ず抽象化する**（後述）     |
| プッシュ         | expo-notifications + Expo Push Service              | APNs/FCMの差異を吸収。サーバーからは単一HTTP API                                                                                                     |
| バックエンド     | Cloudflare Workers + Hono                           |                                                                                                                                                      |
| DB               | Cloudflare D1 + Drizzle ORM                         |                                                                                                                                                      |
| スケジューラ     | Cloudflare Cron Triggers（毎分） + Queues           | 開示タイミング判定・期限終了処理・無応答アラートを担う                                                                                               |
| リアルタイム基盤 | **使わない**                                        | 開示が間欠なので、閲覧は「次回開示時刻に合わせたポーリング + 開示時プッシュ」で十分。WebSocket/Durable Objectsは将来の拡張オプションとしてのみ言及可 |
| 共有コード       | packages/shared に Zod スキーマ + API型             |                                                                                                                                                      |

## 3. リポジトリ構成（pnpm monorepo）

```
.
├── apps/
│   ├── mobile/          # Expo アプリ
│   └── api/             # Cloudflare Workers (Hono)
├── packages/
│   └── shared/          # Zodスキーマ、APIリクエスト/レスポンス型、定数
├── docs/                # このHANDOFF.md、ADR、検証ログ
├── .github/workflows/
├── .claude/             # Claude Code 設定・スキル
├── CLAUDE.md
├── AGENTS.md
├── lefthook.yml
├── .oxlintrc.json / .oxfmtrc.json / .ls-lint.yml / knip.json
├── .editorconfig / .vscode/
├── pnpm-workspace.yaml
└── package.json         # packageManager: pnpm@11系、preinstall: only-allow pnpm
```

## 4. ツールチェーンと規約（newt239/next-template 踏襲）

https://github.com/newt239/next-template の構成をmonorepoに拡張して適用する。**ESLint / Prettierは導入しない**（oxc系で統一）。

- **リンタ**: oxlint（`--type-aware`、oxlint-tsgolint併用）。ルートの `.oxlintrc.json` で全ワークスペースを対象にする。React Nativeコードにも適用する。
- **フォーマッタ**: oxfmt。`format`（--check）/ `format:fix` のスクリプト命名をテンプレートに合わせる。
- **その他の静的チェック**: ls-lint（ファイル命名規則）、knip（未使用コード検出。Expo/Workersのエントリポイントを `knip.json` で明示すること）。
- **Gitフック**: lefthook。pre-commitで oxlint + oxfmt を差分に対して実行、pre-pushで `codecheck` 相当。
- **集約スクリプト**: ルートに `codecheck` を用意し、`typecheck` → `lint` → `format` → `ls-lint` → `knip` を直列実行する（テンプレートの `codecheck` と同じ思想）。各ワークスペースへは `pnpm -r` で伝播させる。
- **テスト**: Vitest（shared / api のユニットテスト。特に開示ロジックと期限判定は必ずテストを書く）。apiは `@cloudflare/vitest-pool-workers` を検討。mobileのE2Eは当面スコープ外（Maestroを将来候補としてメモに残す）。
- **バージョン管理**: 依存はテンプレート同様に完全固定（^や~を付けない）。`preinstall: npx only-allow pnpm`。
- **型**: strict。ZodスキーマをAPI境界の単一の真実とし、`z.infer` で型を導出する。

### CI（GitHub Actions）

以下のワークフローを最初に整備する。

1. **ci.yml（PR + main push）**: pnpmキャッシュ → `codecheck` と `test` を実行。ジョブを分割して並列化する（typecheck/lint/format系とtestを別ジョブに）。
2. **deploy-api.yml（main push、apps/api配下の変更時）**: wrangler-action で Workers + D1マイグレーションをデプロイ。D1マイグレーションは `drizzle-kit generate` で生成したSQLを `wrangler d1 migrations apply` で適用する運用にする。
3. **eas.yml（手動 / タグ）**: EAS Buildのトリガー。EAS Updateによる OTA 配信は main マージ時に `eas update` を打つジョブとして分離する（ネイティブ変更を含むPRかどうかで運用が分かれる点をREADMEに明記）。
4. Dependabot（pnpm対応設定）と、pathsフィルタによるモバイル/API変更の判定を入れる。

## 5. データモデル（初期案）

Drizzleスキーマは packages/shared ではなく apps/api 配下に置き、型のみsharedへ再エクスポートする。以下は出発点であり、カラム追加は自由。

```
users            id, display_name, created_at
push_tokens      id, user_id, expo_push_token, platform, updated_at
sessions         id, owner_id, title, invite_code(短命・推測不能),
                 interval_sec, starts_at, expires_at,
                 precision('exact'|'coarse'), status('scheduled'|'active'|'ended'),
                 next_disclosure_at, created_at
memberships      id, session_id, user_id, role('owner'|'member'),
                 sharing_enabled, last_uploaded_at, joined_at
location_points  id, session_id, membership_id, captured_at,
                 lat, lng, accuracy_m, battery(任意), uploaded_at
disclosures      id, session_id, disclosed_at
                 # 開示イベントの記録。開示ビューは
                 # 「disclosed_at時点以前で各メンバー最新のlocation_point」をクエリで解決
alerts           id, session_id, membership_id, type('no_response'|'session_end'),
                 fired_at
```

**開示ロジックの要件**（最重要のドメインロジック。ユニットテスト必須）:

- Cron（毎分）が `status='active' AND next_disclosure_at <= now` のセッションを取得し、disclosureレコードを作成、`next_disclosure_at += interval_sec` を更新、参加者へプッシュをQueuesでファンアウトする。
- 参加者向けAPIは「最新のdisclosure時点の各メンバー位置」のみ返す。disclosure以降にアップロードされた点は絶対に返さない。**自分自身の現在位置は常に見えてよい**。
- `expires_at <= now` のセッションは `status='ended'` に更新し、終了プッシュを送る。ended以降のlocation_pointsアップロードは**サーバー側で拒否**する（クライアント側の停止と二重化）。
- 無応答アラート: activeセッションで `last_uploaded_at` が閾値（例: interval_sec × 3）を超えたメンバーがいたら、主催者（将来: 指定した見守り相手）へプッシュ。同一メンバーへの連続発火はクールダウンさせる。

## 6. API設計（初期案・Hono）

認証は初期はデバイス匿名認証（初回起動でuser作成しトークン発行）で開始し、アカウント連携は未決事項とする。

```
POST   /sessions                        セッション作成（interval_sec, starts_at, expires_at, precision）
POST   /sessions/join                   invite_codeで参加
GET    /sessions/:id                    セッション詳細 + メンバー一覧
POST   /sessions/:id/end                主催者による即時終了
POST   /sessions/:id/locations          位置のバッチアップロード（複数点をまとめて受ける）
GET    /sessions/:id/map                最新開示時点の全メンバー位置 + next_disclosure_at
GET    /sessions/:id/history            開示履歴（日次ログ/リプレイ用）
PUT    /me/push-token                   Expo Push token登録
```

`GET /sessions/:id/map` が `next_disclosure_at` を返すことで、クライアントはその時刻+αに1回だけ再フェッチすればよく、無駄なポーリングを避けられる。

## 7. モバイル実装方針

### 位置取得層の抽象化

`apps/mobile/src/features/location/` に `LocationTracker` インターフェースを定義し、expo-location実装をその背後に隠す。公開APIは `start(session)`, `stop()`, `getStatus()` 程度に絞る。Transistorsoft製ライブラリへの差し替え可能性のための構造。

### expo-location の設定要点

- `startLocationUpdatesAsync` を expo-task-manager のタスクと組で使用。`timeInterval` は短め（5〜15秒）に取得し、`deferredUpdatesInterval` をセッションのinterval_secに近づけてバッテリーと通信量を抑える。アップロードはバッチ（`POST /locations` に複数点）。
- **Android**: `foregroundService` オプションで位置情報タイプのフォアグラウンドサービス（常駐通知）を使う。**アプリがフォアグラウンドにある間にサービスを開始する**設計を厳守することで、`ACCESS_BACKGROUND_LOCATION` を宣言せずに済ませることを狙う（Google Playの背景位置情報審査の回避）。app.jsonのexpo-locationプラグイン設定では `isAndroidForegroundServiceEnabled: true` とし、`isAndroidBackgroundLocationEnabled` は当面falseで検証する。
- **iOS**: フォアグラウンド権限（When In Use）→ バックグラウンド権限（Always）の2段階昇格。expo-locationのバックグラウンド追跡はAlwaysが必要。`showsBackgroundLocationIndicator: true`。purpose stringには「参加中のセッションの間だけ、設定した間隔で位置を共有するため」という有限性を明記する。
- 権限昇格の前に、**理由説明の自前モーダル**を必ず挟む（Android 11+ではシステム設定画面へ遷移するため特に重要。UX上も審査上も必須）。

### UI方針

- 設定・フォーム・リスト・シート系（セッション作成のインターバル/期限ピッカー、参加者リスト、設定画面）は `@expo/ui` のユニバーサルコンポーネントを第一選択とし、必要に応じて `@expo/ui/swift-ui` / `@expo/ui/jetpack-compose` へ落とす。Host境界内はSwiftUI/Composeのレイアウトシステムであることに注意（Yoga flexboxではない）。
- 地図画面のオーバーレイ（次回開示までのカウントダウン、メンバーチップ等）はRNプリミティブで自由に作ってよい。
- カウントダウン表示はサーバーの `next_disclosure_at` を基準にし、端末時計に依存しない。

### 招待導線

expo-routerのディープリンク + ユニバーサルリンク/アプリリンクで `https://<domain>/join/<invite_code>` を受ける。QRコードは同URLをエンコードするだけ。未インストール時のストア誘導はMVPではWebの中継ページ1枚で対応。

## 8. マイルストーン

**M0: 足場**（このドキュメントのセクション3・4をすべて満たすscaffold）
monorepo初期化、ツールチェーン、CI、CLAUDE.md生成、apps/api のHello World デプロイ、apps/mobile のdev client起動まで。

**M1: バックグラウンド位置検証スパイク（最優先・他より先に完了させる）**
UIを作り込まず、以下のプロトコルをiOS/Android実機で通す使い捨てに近い画面でよい。

- [ ] フォアグラウンドで追跡開始 → 画面オフ・他アプリ操作で30分放置 → D1に位置が届き続ける
- [ ] Android: ACCESS_BACKGROUND_LOCATION なし（フォアグラウンドサービスのみ）で上記が成立する
- [ ] iOS: Always権限で上記が成立し、ステータスバーのインジケータ挙動を記録
- [ ] `expires_at` 到達でクライアントが自走停止し、サーバーも以降のアップロードを拒否する
- [ ] 電池消費の実測（1時間あたり%）を docs/ に記録
- [ ] 端末の省電力モード・Doze下での挙動を記録

このスパイクの結果次第で expo-location 続行か Transistorsoft 移行かを判断する。**結果はdocs/spike-location.mdに必ず残すこと。**

**M2: スキーマ + API + 開示ロジック**（セクション5・6。開示・期限・無応答のユニットテスト込み）

**M3: セッションのライフサイクル**（作成 → 招待 → 参加 → 開始 → 終了のE2Eフロー、権限オンボーディング含む）

**M4: 地図と開示体験**（expo-maps表示、開示時プッシュ、カウントダウン、開示履歴の簡易リプレイ）

**M5: 見守り機能**（無応答アラート、セッション終了通知、履歴の自動削除ジョブ）

**M6: 磨き**（Expo UIでのネイティブ感の仕上げ、空状態、エラーハンドリング、ストア審査準備ドキュメント）

## 9. 未決事項（実装中に提案してほしいこと）

1. **プロダクト名 / Bundle ID**: 未定。仮に `intervalmap` 等のコードネームでよい。
2. **認証**: 匿名デバイス認証で開始する前提だが、機種変更時の引き継ぎ方式（better-auth導入か、リンクコード方式か）は提案がほしい。
3. **D1のリージョン特性とレイテンシ**: 位置アップロードの書き込み頻度が高いため、実測して問題があればWorkers KV/Queuesバッファリングを提案してほしい。
4. **expo-maps の成熟度**: 実装時点で要件（複数マーカー、カスタムマーカー、追従）に不足があれば react-native-maps への切り替えを提案してよい。
5. **鬼ごっこモード**: 役職（鬼/逃走者）による可視性の非対称はスキーマ拡張で将来対応する。MVPでは全員対等の可視性とし、拡張しやすいようmembershipsにrole列の余地だけ残す。

## 10. Claude Codeへの作業指示

- 最初のタスクは「M0の完了」。その際、このドキュメントの規約を反映した **CLAUDE.md をリポジトリルートに生成**すること（コマンド一覧、コード規約、開示ロジックの不変条件、Expo Go禁止の注意を含める）。
- コミット前に必ず `pnpm codecheck` を通すこと。lefthookで強制する。
- 位置情報・プライバシーに関わる不変条件（開示前の位置を返さない、期限後に追跡しない、履歴の自動削除）を変更するコードには、必ずテストとコメントを添えること。
- ネイティブ設定（app.json plugins、Info.plist、AndroidManifest）を変更した場合は、EAS Buildの再ビルドが必要である旨をPR説明に明記すること。
- 不明点はこのドキュメントの該当セクション番号を引用して質問すること。
