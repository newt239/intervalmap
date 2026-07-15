// ドメイン共通の不変条件の定数。変更時は必ずテストとレビューを添える。

// セッション終了後に位置履歴を自動削除するまでの日数。
export const DEFAULT_HISTORY_RETENTION_DAYS = 30;

// 無応答判定の閾値係数。last_uploaded_at が interval_sec × この係数を超えたら無応答。
export const NO_RESPONSE_INTERVAL_MULTIPLIER = 3;

// 無応答アラートの連続発火を抑止するクールダウン秒数。
export const NO_RESPONSE_ALERT_COOLDOWN_SEC = 600;

// インターバルの下限・上限秒数。
export const MIN_INTERVAL_SEC = 30;
export const MAX_INTERVAL_SEC = 24 * 60 * 60;

// セッションの最大有効期間秒数。無期限追跡を作らないための上限。
export const MAX_SESSION_DURATION_SEC = 30 * 24 * 60 * 60;

// セッションの最小有効期間秒数。
export const MIN_SESSION_DURATION_SEC = 60;

// 招待コードの文字数。短命かつ推測不能であること。
export const INVITE_CODE_LENGTH = 10;

// 招待コードの文字集合。紛らわしい文字を除いた32文字で modulo バイアスもない。
export const INVITE_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

// 招待リンクのベース URL。リンクは `${INVITE_URL_BASE}/join/${code}` で組み立てる。
export const INVITE_URL_BASE = "https://intervalmap.newt239.dev";

// 位置バッチアップロードで一度に受け付ける最大点数。
export const MAX_LOCATION_BATCH_SIZE = 100;
