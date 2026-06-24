import dotenv from "dotenv";
import { Bot, Context, InlineKeyboard } from "grammy";
import { ChildProcess, spawn } from "child_process";
import { writeFileSync, existsSync, readFileSync, unlinkSync } from "fs";

const PID_FILE = "./userbot.pid";

dotenv.config();

const CONTROLLER_BOT_TOKEN = process.env.CONTROLLER_BOT_TOKEN;
const OWNER_ID_RAW = process.env.OWNER_TELEGRAM_ID;

if (!CONTROLLER_BOT_TOKEN) {
   console.error("Missing CONTROLLER_BOT_TOKEN in environment (.env). Set CONTROLLER_BOT_TOKEN=your_bot_token");
   process.exit(1);
}

if (!OWNER_ID_RAW) {
   console.error("Missing OWNER_TELEGRAM_ID in environment (.env). Set OWNER_TELEGRAM_ID=your_telegram_id");
   process.exit(1);
}

const OWNER_ID = parseInt(OWNER_ID_RAW, 10);
if (Number.isNaN(OWNER_ID)) {
   console.error("Invalid OWNER_TELEGRAM_ID; must be a number (your Telegram numeric id)");
   process.exit(1);
}

const bot = new Bot(CONTROLLER_BOT_TOKEN);

let userbotProcess: ChildProcess | null = null;

function isOwner(ctx: Context | { from?: { id?: number } } ): boolean {
   return ctx.from?.id === OWNER_ID;
}

async function sendControlKeyboard() {
   const keyboard = new InlineKeyboard()
      .text("▶️ Start", "ctrl:start")
      .text("⏹️ Stop", "ctrl:stop")
      .row()
      .text("ℹ️ Status", "ctrl:status");

   try {
      await bot.api.sendMessage(OWNER_ID, "Kontrol userbot:", { reply_markup: keyboard });
   } catch (e) {
      console.error("Gagal mengirim keyboard kontrol:", e);
   }
}

async function startUserbot(ctx?: Context) {
   if (ctx && !isOwner(ctx)) return ctx.reply("❌ Tidak diizinkan.");

   if (userbotProcess) {
      if (ctx) return ctx.reply("⚠️ Userbot sudah berjalan.");
      await bot.api.sendMessage(OWNER_ID, "⚠️ Userbot sudah berjalan.");
      return;
   }

   userbotProcess = spawn("npx", ["ts-node", "src/index.ts"], {
      stdio: "pipe",
      shell: true,
      detached: true,
   });

   userbotProcess.unref();

   userbotProcess.stdout?.on("data", (data: Buffer) => {
      const log = data.toString().trim();
      console.log(log);
      if (
         log.includes("✅") ||
         log.includes("🔄") ||
         log.includes("⏰") ||
         log.includes("❓")
      ) {
         bot.api.sendMessage(OWNER_ID, `\`${log}\``, { parse_mode: "Markdown" });
      }
   });

   userbotProcess.on("exit", (code: number | null) => {
      if (userbotProcess !== null) {
         userbotProcess = null;
         bot.api.sendMessage(OWNER_ID, `⚠️ Userbot berhenti tidak terduga (exit code: ${code})`);
      }
      bot.api.sendMessage(OWNER_ID, `⚠️ Userbot berhenti (exit code: ${code})`);
   });

   if (ctx) await ctx.reply("✅ Userbot berhasil dijalankan!");
   else await bot.api.sendMessage(OWNER_ID, "✅ Userbot berhasil dijalankan!");

   await sendControlKeyboard();
}

async function stopUserbot(ctx?: Context) {
   if (ctx && !isOwner(ctx)) return ctx.reply("❌ Tidak diizinkan.");

   if (!userbotProcess) {
      if (ctx) return ctx.reply("⚠️ Userbot tidak sedang berjalan.");
      await bot.api.sendMessage(OWNER_ID, "⚠️ Userbot tidak sedang berjalan.");
      return;
   }

   const proc = userbotProcess;
   userbotProcess = null;

   try {
      if (existsSync(PID_FILE)) {
         const pid = parseInt(readFileSync(PID_FILE, "utf-8").trim());
         unlinkSync(PID_FILE);
         process.kill(pid, "SIGTERM");
      } else {
         // Fallback
         proc.kill("SIGTERM");
      }
   } catch (e) {
      console.error("Kill error:", e);
      try { proc.kill("SIGKILL"); } catch {}
   }

   if (ctx) return ctx.reply("🛑 Userbot dihentikan.");
   return bot.api.sendMessage(OWNER_ID, "🛑 Userbot dihentikan.");
}

bot.command("start", async (ctx: Context) => startUserbot(ctx));

bot.command("stop", async (ctx: Context) => stopUserbot(ctx));

bot.command("status", async (ctx: Context) => {
   if (!isOwner(ctx)) return ctx.reply("❌ Tidak diizinkan.");
   ctx.reply(userbotProcess ? "🟢 Userbot sedang berjalan." : "🔴 Userbot tidak berjalan.");
});

bot.command("menu", async (ctx: Context) => {
   if (!isOwner(ctx)) return ctx.reply("❌ Tidak diizinkan.");
   await sendControlKeyboard();
});

bot.callbackQuery("ctrl:start", async (ctx) => {
   try { await ctx.answerCallbackQuery(); } catch {}
   await startUserbot(ctx as Context);
});

bot.callbackQuery("ctrl:stop", async (ctx) => {
   try { await ctx.answerCallbackQuery(); } catch {}
   await stopUserbot(ctx as Context);
});

bot.callbackQuery("ctrl:status", async (ctx) => {
   try { await ctx.answerCallbackQuery(); } catch {}
   const running = userbotProcess ? "🟢 Userbot sedang berjalan." : "🔴 Userbot tidak berjalan.";
   try {
      await ctx.editMessageText(`Status: ${running}`);
   } catch (e) {
      await ctx.reply(running);
   }
});

;(async () => {
   try {
      await bot.api.setMyCommands([
         { command: "start", description: "Jalankan userbot" },
         { command: "stop", description: "Hentikan userbot" },
         { command: "status", description: "Cek status userbot" },
         { command: "menu", description: "Tampilkan kontrol (Start/Stop)" },
      ]);
   } catch (e) {
      console.error("Gagal set commands:", e);
   }

   bot.start();
   console.log("🎮 Controller bot aktif!");
})();