import { Hono } from "hono";

import { INVITE_ALPHABET, INVITE_CODE_LENGTH } from "@intervalmap/shared";

// 認証なしで配信する招待の中継ページとユニバーサルリンク検証ファイル。

// Apple Developer の Team ID。ユニバーサルリンク有効化時に実値へ差し替える。
const APPLE_TEAM_ID = "PLACEHOLDER_APPLE_TEAM_ID";

// リリース署名証明書の SHA-256 fingerprint。EAS の認証情報から取得して差し替える。
const ANDROID_CERT_SHA256 = "PLACEHOLDER_ANDROID_CERT_SHA256";

const BUNDLE_ID = "dev.newt239.intervalmap";

// 招待コードの形式検証。HTML に埋め込む前の XSS 対策として必須。
const inviteCodePattern = new RegExp(`^[${INVITE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`, "u");

export const publicRoute = new Hono()
  // 招待リンクの中継ページ。コードの有効性は漏らさないため DB は引かない。
  .get("/join/:code", async (c) => {
    const code = c.req.param("code");
    if (!inviteCodePattern.test(code)) {
      return c.notFound();
    }
    return c.html(
      `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>intervalmap の招待</title>
</head>
<body>
<h1>intervalmap の招待</h1>
<p><a href="intervalmap://join/${code}">アプリで開く</a></p>
<p>開けない場合は intervalmap アプリが必要です。インストール後にもう一度このリンクを開いてください。</p>
</body>
</html>`,
    );
  })

  // iOS ユニバーサルリンクの検証ファイル。
  .get("/.well-known/apple-app-site-association", (c) =>
    c.json({
      applinks: {
        details: [
          {
            appIDs: [`${APPLE_TEAM_ID}.${BUNDLE_ID}`],
            components: [{ "/": "/join/*" }],
          },
        ],
      },
    }),
  )

  // Android App Links の検証ファイル。
  .get("/.well-known/assetlinks.json", (c) =>
    c.json([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: BUNDLE_ID,
          sha256_cert_fingerprints: [ANDROID_CERT_SHA256],
        },
      },
    ]),
  );
