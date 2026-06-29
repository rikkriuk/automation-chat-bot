import dotenv from "dotenv";
import { Bot, GrammyError } from "grammy";
import { registerCommands } from "./commands";
import { registerCallbacks } from "./callbacks";
import { registerMessages } from "./messages";

dotenv.config();

const CONTROLLER_BOT_TOKEN = process.env.CONTROLLER_BOT_TOKEN!;
const OWNER_ID = parseInt(process.env.OWNER_TELEGRAM_ID!, 10);

const bot = new Bot(CONTROLLER_BOT_TOKEN);
const autoFallback = { value: true };

registerCommands(bot, OWNER_ID, autoFallback);
registerCallbacks(bot, OWNER_ID, autoFallback);
registerMessages(bot, OWNER_ID, autoFallback);

bot.catch((err) => {
   if (err.error instanceof GrammyError) {
      if (err.error.description.includes("query is too old")) {
         console.log("⚠️ Callback query expired, diabaikan.");
         return;
      }
      console.error("❌ Grammy error:", err.error.description);
   } else {
      console.error("❌ Unknown error:", err.error);
   }
});

(async () => {
   await bot.api.setMyCommands([
      { command: "menu", description: "Tampilkan kontrol semua akun" },
      { command: "status", description: "Cek status semua akun" },
      { command: "addaccount", description: "Tambah akun baru" },
      { command: "removeaccount", description: "Hapus akun" },
   ]).catch(console.error);

   bot.start();
   console.log("🎮 Controller bot aktif!");
})();