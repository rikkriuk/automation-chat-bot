import { TelegramClient } from "telegram";
import { NewMessage, NewMessageEvent } from "telegram/events";
import { state, resetState } from "../state";
import { handlePartnerFound, processUserReply } from "./flow";
import {
  TRIGGER_PARTNER_FOUND,
  TRIGGER_CHAT_ENDED,
  TRIGGER_SEARCHING,
  SYSTEM_MESSAGES,
} from "../config/triggers";

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function registerEventHandlers(client: TelegramClient, username: string) {
   client.addEventHandler(async (event: NewMessageEvent) => {
      const message = event.message;
      if (!message?.text) return;
      if (message.out) return;

      try {
         const text = message.text.trim();
         const lower = text.toLowerCase();

         console.log("📩 Received:", text);

         if (lower.includes("dibatasi")) {
            console.log("⚠️ Terbatas oleh sistem → menghentikan userbot.");
            try {
               await client.disconnect();
            } catch (e) {
               console.error("Error saat disconnect:", e);
            }
            process.exit(2);
         }

         if (SYSTEM_MESSAGES.some(phrase => lower.includes(phrase))) {
            console.log("🤖 Pesan sistem → abaikan");
            return;
         }

         if (TRIGGER_PARTNER_FOUND.some(phrase => lower.includes(phrase))) {
            state.isSearching = false;
            await handlePartnerFound(client, username);
            return;
         }

         if (TRIGGER_SEARCHING.some(phrase => lower.includes(phrase))) {
            console.log("🔍 Sedang mencari partner, standby...");
            state.isSearching = true;
            state.chatAborted = true;
            await sleep(100);
            resetState();
            return;
         }

         if (TRIGGER_CHAT_ENDED.some(phrase => lower.includes(phrase))) {
            console.log("🔄 Chat berakhir → abort + reset");
            state.chatAborted = true;
            await sleep(100);
            resetState();

            if (!state.isSearching) {
               console.log("🔍 Auto /search...");
               state.isSearching = true;
               await sleep(1500 + Math.random() * 1000);
               await client.sendMessage(username, { message: "/search" });
            } else {
               console.log("⏳ Sudah searching, skip auto /search");
            }
            return;
         }

         if (state.isProcessing) {
            await processUserReply(client, text, username);
         }
      } catch (err) {
         console.error("Error:", err);
      }
   }, new NewMessage({}));
}