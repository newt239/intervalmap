# ADR-0001: バックグラウンド位置取得ライブラリの選定

- ステータス: 採用
- 日付: 2026-07-02
- 関連: [handoff.md](../handoff.md) §2・§7・M1

## 背景

アプリが前面にない間も位置を継続取得しサーバーへ送り続ける必要がある。制約は3つ。

- 追跡は `expires_at` で必ず自動停止する。
- Android は `ACCESS_BACKGROUND_LOCATION` を宣言せず、フォアグラウンドサービスのみで成立させる（Google Play の背景位置審査の回避）。
- 位置取得層は `LocationTracker` インターフェースで抽象化し、差し替え可能にする。

## 検討した選択肢

| 選択肢                                                | 評価                                                                                                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **expo-location + expo-task-manager（採用）**         | Expo 公式で SDK と同期メンテ。フォアグラウンドサービス・OS バッチング（`deferredUpdatesInterval`）対応。追加コストゼロ。弱点はタスクキル後の自動復帰がないこと                             |
| react-native-background-geolocation（Transistorsoft） | 信頼性は最高（モーション検知・キル後復帰・HTTP 内蔵）。ただし Android 本番ライセンスが有償で、内蔵 HTTP は「サーバー権威の開示制御」と設計が二重になる。**差し替え先の第一候補として維持** |
| expo-background-task / expo-background-fetch          | 実行間隔が最短約15分かつ OS 裁量。「連続取得」を満たせず不採用                                                                                                                             |
| @mauron85/react-native-background-geolocation         | 数年メンテ停止。New Architecture 未対応で不採用                                                                                                                                            |
| react-native-geolocation-service 等                   | フォアグラウンド取得が主目的でバックグラウンドの面倒を見ない。不採用                                                                                                                       |
| 自前ネイティブモジュール                              | 2プラットフォームの実装・保守コストが MVP に見合わない。最終手段                                                                                                                           |

## 決定

**expo-location + expo-task-manager を採用する。** M1 実機スパイクの結果が [spike-location.md](../spike-location.md) の合格基準を満たさない場合、Transistorsoft 版 `LocationTracker` を追加して差し替える。

## 実装上の要点

- 取得は10秒間隔で連続、`deferredUpdatesInterval` を開示インターバルに寄せて OS バッチング。上限60秒は無応答アラート判定 `interval_sec × 3` の誤発火防止。
- アップロードは `POST /sessions/:id/locations` へのバッチ送信。失敗分はキュー保持し、上限超過は古い順に破棄。
- タスクは追跡コンテキストを SecureStore から読み、`expires_at` 超過で自ら停止する。サーバーの ended 拒否（410）を受けた場合も即時停止する。
