import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { requiredEnv as env } from "./config/env";
import { registerEventHandlers } from "./handlers/events";
import { writeFileSync, unlinkSync } from "fs";

const PID_FILE = "./userbot.pid";

(async () => {
   writeFileSync(PID_FILE, String(process.pid));

   const client = new TelegramClient(
      new StringSession(env.SESSION_STRING),
      parseInt(env.API_ID),
      env.API_HASH,
      { 
         connectionRetries: 5,
         retryDelay: 3000,
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
         }
      } catch (e) {
         console.error("❌ Reconnect gagal:", e);
      }
   }, 30_000);

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