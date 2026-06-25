import { TelegramClient } from "telegram";

export const state = {
   isProcessing: false,
   currentStep: 0,
   chatAborted: false,
   isSearching: false,
   detectedAge: null as number | null,
   replyTimeout: null as NodeJS.Timeout | null,
};

export function resetState() {
   state.isProcessing = false;
   state.currentStep = 0;
   state.chatAborted = false;
   state.detectedAge = null;
   clearReplyTimeout();
}

export function clearReplyTimeout() {
   if (state.replyTimeout) {
      clearTimeout(state.replyTimeout);
      state.replyTimeout = null;
   }
}

export function startReplyTimeout(client: TelegramClient, username: string) {
   clearReplyTimeout();
   state.replyTimeout = setTimeout(async () => {
      if (!state.isProcessing || state.chatAborted) return;
      console.log("⏰ Timeout 30 detik, tidak ada balasan → Skip");
      await client.sendMessage(username, { message: "/next" });
      resetState();
   }, 30000);
}