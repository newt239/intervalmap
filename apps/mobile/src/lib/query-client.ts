import { AppState } from "react-native";

import { QueryClient, focusManager } from "@tanstack/react-query";

export const queryClient = new QueryClient();

// RN にはウィンドウフォーカスが無いため AppState の active をフォーカスとして扱う。
AppState.addEventListener("change", (state) => {
  focusManager.setFocused(state === "active");
});
