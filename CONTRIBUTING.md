# CONTRIBUTING

開発環境の構築、Mac でのエミュレータ起動、実機での検証手順。コマンド一覧と規約は [AGENTS.md](AGENTS.md) を参照。

## 前提

- macOS。Node は [.node-version](.node-version) 固定、パッケージマネージャは pnpm 11 固定。
- iOS 開発: Xcode（App Store から）と iOS シミュレータランタイム。
- Android 開発: Android Studio と SDK。
- 実機検証・dev client ビルド: Expo アカウント。
- **Expo Go は使えない。** バックグラウンド位置情報がネイティブモジュールを要求するため、必ず expo-dev-client 入りのビルドを使う。

```sh
pnpm install
pnpm prepare    # Git フックを有効化
```

## API をローカルで動かす

```sh
pnpm --filter @intervalmap/api db:migrate:local   # 初回とスキーマ変更時
pnpm --filter @intervalmap/api dev                # http://localhost:8787
```

モバイルからの接続先は環境変数 `EXPO_PUBLIC_API_URL` で指定する。`apps/mobile/.env` に書いてもよい。

| 実行環境             | 接続先                                                                    |
| -------------------- | ------------------------------------------------------------------------- |
| iOS シミュレータ     | `http://localhost:8787`                                                   |
| Android エミュレータ | `http://10.0.2.2:8787`                                                    |
| 実機                 | `http://<MacのLAN IP>:8787`（同一 Wi-Fi）またはデプロイ済み Worker の URL |

## iOS シミュレータの起動（Mac）

1. Xcode を開き、初回は iOS ランタイムをダウンロードしておく（`xcodebuild -downloadPlatform iOS` でも可）。
2. dev client をビルドしてシミュレータで起動する。初回はネイティブビルドで数分かかる。

   ```sh
   pnpm --filter @intervalmap/mobile ios
   # シミュレータを指定する場合
   pnpm --filter @intervalmap/mobile exec expo run:ios --device "iPhone 16"
   ```

3. 2回目以降は Metro だけ起動し、`i` キーでシミュレータを開く。

   ```sh
   EXPO_PUBLIC_API_URL=http://localhost:8787 pnpm --filter @intervalmap/mobile start
   ```

- **位置情報のシミュレート**: Simulator のメニュー Features > Location から Custom Location や Freeway Drive を選ぶ。
- シミュレータではバックグラウンド追跡や電池消費を正しく検証できない。最終確認は実機で行う。

## Android エミュレータの起動（Mac）

1. Android Studio の Device Manager で AVD（仮想デバイス）を作成しておく。
2. エミュレータを起動する。Device Manager の ▶ か、CLI から:

   ```sh
   ~/Library/Android/sdk/emulator/emulator -list-avds
   ~/Library/Android/sdk/emulator/emulator @<AVD名>
   ```

3. dev client をビルドして起動する。

   ```sh
   pnpm --filter @intervalmap/mobile android
   ```

4. 2回目以降は Metro を起動して `a` キー。

   ```sh
   EXPO_PUBLIC_API_URL=http://10.0.2.2:8787 pnpm --filter @intervalmap/mobile start
   ```

- **位置情報のシミュレート**: エミュレータ右側の「…」（Extended Controls）> Location。GPX/KML のルート再生もできる。
- フォアグラウンドサービス通知や Doze の挙動もエミュレータである程度確認できるが、判定は実機で行う。

## 実機での検証

バックグラウンド位置・フォアグラウンドサービス・電池消費は実機でしか判定できない。検証項目と記録先は [docs/spike-location.md](docs/spike-location.md)。

### EAS Build でインストールする（推奨）

```sh
cd apps/mobile
npx eas-cli login
npx eas-cli device:create      # iOS のみ。検証端末を Ad Hoc 登録する
npx eas-cli build --profile development --platform ios
npx eas-cli build --profile development --platform android
```

ビルド完了後に表示される QR/リンクから実機にインストールする。その後 Mac で Metro を起動し、実機と同一 Wi-Fi で接続する。

```sh
EXPO_PUBLIC_API_URL=http://<MacのLAN IP>:8787 pnpm --filter @intervalmap/mobile start
```

dev client が Metro を見つけられない場合は、アプリ起動画面で URL（`exp+intervalmap://` または Mac の IP:8081）を手入力する。

### ケーブル接続でローカルビルドする

- iOS: `pnpm --filter @intervalmap/mobile exec expo run:ios --device`（Apple Developer の署名設定が必要）
- Android: 端末の USB デバッグを有効にし `pnpm --filter @intervalmap/mobile android`（`adb devices` で認識を確認）

### 注意

- **ネイティブ設定（`app.config.ts` の plugins / Info.plist / AndroidManifest）やネイティブ依存を変更したら dev client の再ビルドが必要。** JS のみの変更は Metro のリロードで反映される。
- バックグラウンド検証は「追跡開始 → 画面オフで30分放置 → D1 に位置が届き続けるか」を軸に行い、結果を [docs/spike-location.md](docs/spike-location.md) に記録する。
