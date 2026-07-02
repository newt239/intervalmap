// Expo Push Service への送信。APNs/FCM の差異は Expo 側で吸収される。
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

// Expo Push API が一度に受け付ける最大メッセージ数。
const PUSH_CHUNK_SIZE = 100;

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

export type PushSender = (messages: PushMessage[]) => Promise<void>;

// プッシュは補助機能。送信失敗で開示・期限処理を止めないためエラーはログに留める。
export const sendExpoPush: PushSender = async (messages) => {
  for (let i = 0; i < messages.length; i += PUSH_CHUNK_SIZE) {
    const chunk = messages.slice(i, i + PUSH_CHUNK_SIZE);
    try {
      const res = await fetch(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) {
        console.error("Expo push 送信に失敗", res.status, await res.text());
      }
    } catch (error) {
      console.error("Expo push 送信に失敗", error);
    }
  }
};
