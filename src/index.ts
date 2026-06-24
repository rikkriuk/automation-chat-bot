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
      { connectionRetries: 5 }
   );

   await client.connect();
   console.log("🤖 Userbot connected!");

   registerEventHandlers(client, env.TARGET_USERNAME);

   await client.sendMessage(env.TARGET_USERNAME, { message: "/next" });
   console.log("📨 /next dikirim!");

   const cleanup = async () => {
      try { unlinkSync(PID_FILE); } catch {}
      try { await client.disconnect(); } catch {}
      process.exit(0);
   };

   process.on("SIGINT", cleanup);
   process.on("SIGTERM", cleanup);
})();