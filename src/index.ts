import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { requiredEnv as env } from "./config/env";
import { registerEventHandlers } from "./handlers/events";
import { writeFileSync, unlinkSync } from "fs";

const accountId = process.env.ACCOUNT_ID || "1";
const PID_FILE = `./userbot-${accountId}.pid`;

(async () => {
   writeFileSync(PID_FILE, String(process.pid));

   const client = new TelegramClient(
      new StringSession(env.SESSION_STRING),
      parseInt(env.API_ID),
      env.API_HASH,
      {
         connectionRetries: 10,
         retryDelay: 2000,
         timeout: 30,
         useWSS: false,
      }
   );

   await client.connect();
   console.log("🤖 Userbot connected!");

   registerEventHandlers(client, env.TARGET_USERNAME);
   await client.sendMessage(env.TARGET_USERNAME, { message: "/next" });
   console.log("📨 /next dikirim!");

   const keepAlive = setInterval(async () => {
      try {
         if (!client.connected) {
            console.log("🔄 Reconnecting...");
            await client.connect();
            registerEventHandlers(client, env.TARGET_USERNAME);
         }

         await client.getMe();
      } catch (e: any) {
         console.error("❌ Keepalive error:", e.message);
         if (e.message?.includes("TIMEOUT")) {
            await client.connect();
         }

         let retryDelay = 10_000;
         if (e.message?.includes("TIMEOUT")) {
            console.log(`🔄 Tunggu ${retryDelay/1000}s sebelum reconnect...`);
            await new Promise(r => setTimeout(r, retryDelay));
            retryDelay = Math.min(retryDelay * 2, 120_000);
            await client.connect();
         }
      }
   }, 60_000 + Math.random() * 20_000);

   const cleanup = async () => {
      clearInterval(keepAlive);
      try { unlinkSync(PID_FILE); } catch {}
      try { await client.disconnect(); } catch {}
      process.exit(0);
   };

   process.on("SIGINT", cleanup);
   process.on("SIGTERM", cleanup);

   process.on("uncaughtException", (err) => {
      console.error("💥 Uncaught Exception:", err);
   });

   process.on("unhandledRejection", (reason) => {
      console.error("💥 Unhandled Rejection:", reason);
   });
})();