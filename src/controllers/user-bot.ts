import dotenv from "dotenv";
import { Bot, Context, InlineKeyboard } from "grammy";
import { ChildProcess, spawn } from "child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";

dotenv.config();

const CONTROLLER_BOT_TOKEN = process.env.CONTROLLER_BOT_TOKEN!;
const OWNER_ID = parseInt(process.env.OWNER_TELEGRAM_ID!, 10);

const ACCOUNTS = [
   { id: 1, SESSION_STRING: process.env.SESSION_1!, label: "Akun 1" },
   { id: 2, SESSION_STRING: process.env.SESSION_2!, label: "Akun 2" },
   { id: 3, SESSION_STRING: process.env.SESSION_3!, label: "Akun 3" },
   { id: 4, SESSION_STRING: process.env.SESSION_4!, label: "Akun 4" },
   { id: 5, SESSION_STRING: process.env.SESSION_5!, label: "Akun 5" },
].filter(acc => acc.SESSION_STRING);

const bot = new Bot(CONTROLLER_BOT_TOKEN);

const processes = new Map<number, ChildProcess>();
let currentAccountIndex = 0;
let autoFallback = true;

function getPidFile(accountId: number) {
   return `./userbot-${accountId}.pid`;
}

function getActiveAccount() {
   return ACCOUNTS[currentAccountIndex];
}

async function notify(msg: string) {
   await bot.api.sendMessage(OWNER_ID, msg).catch(console.error);
}

async function startAccount(accountId: number, isAuto = false) {
   const account = ACCOUNTS.find(a => a.id === accountId);
   if (!account) return notify(`❌ Akun ${accountId} tidak ditemukan.`);

   if (processes.has(accountId)) {
      return notify(`⚠️ ${account.label} sudah berjalan.`);
   }

   const envPath = `.env.account${accountId}`;
   writeFileSync(envPath, `SESSION_STRING=${account.SESSION_STRING}\n`);

   const proc = spawn("npx", ["@dotenvx/dotenvx", "run", "--env-file=.env", `--env-file=${envPath}`, "--", "ts-node", "src/index.ts"], {
      stdio: "pipe",
      shell: true,
   });

   proc.stderr?.on("data", (data: Buffer) => {
      const log = data.toString().trim();
      console.error(`[${account.label}] STDERR: ${log}`);
      bot.api
         .sendMessage(OWNER_ID, `[${account.label}] ❌ ${log}`)
         .catch(console.error);
   });

   proc.stdout?.on("data", (data: Buffer) => {
      const log = data.toString().trim();
      console.log(`[${account.label}] ${log}`);
      if (
         log.includes("✅") ||
         log.includes("🔄") ||
         log.includes("⏰") ||
         log.includes("❓")
      ) {
         bot.api
            .sendMessage(OWNER_ID, `[${account.label}] ${log}`)
            .catch(console.error);
      }
   });

   proc.on("exit", async (code) => {
      const wasRunning = processes.has(accountId);
      processes.delete(accountId);
      try { unlinkSync(getPidFile(accountId)); } catch {}
      if (wasRunning) {
         await notify(`⚠️ ${account.label} berhenti tidak terduga (exit code: ${code})`);
         if (autoFallback) await tryFallback(accountId);
      }
   });

   processes.set(accountId, proc);

   const label = isAuto ? `🔄 Auto-switch ke ${account.label}` : `✅ ${account.label} berhasil dijalankan!`;
   await notify(label);
   await sendControlKeyboard();
}

async function tryFallback(failedAccountId: number) {
   const nextAccount = ACCOUNTS.find(
      a => a.id !== failedAccountId && !processes.has(a.id)
   );

   if (!nextAccount) {
      await notify("❌ Semua akun sudah dicoba atau sedang berjalan. Tidak ada fallback.");
      return;
   }

   await notify(`🔁 Mencoba fallback ke ${nextAccount.label}...`);
   await startAccount(nextAccount.id, true);
}

async function stopAccount(accountId: number) {
   const account = ACCOUNTS.find(a => a.id === accountId);
   const proc = processes.get(accountId);

   if (!proc) {
      return notify(`⚠️ ${account?.label ?? `Akun ${accountId}`} tidak sedang berjalan.`);
   }

   processes.delete(accountId);

   const pidFile = getPidFile(accountId);
   try {
      if (existsSync(pidFile)) {
         const pid = parseInt(readFileSync(pidFile, "utf-8").trim());
         unlinkSync(pidFile);
         process.kill(pid, "SIGTERM");
      } else {
         proc.kill("SIGTERM");
      }
   } catch {
      try { proc.kill("SIGKILL"); } catch {}
   }

   await notify(`🛑 ${account?.label} dihentikan.`);
}

async function stopAll() {
   for (const acc of ACCOUNTS) {
      if (processes.has(acc.id)) await stopAccount(acc.id);
   }
}

async function sendControlKeyboard() {
   const keyboard = new InlineKeyboard();

   ACCOUNTS.forEach((acc, i) => {
      const isRunning = processes.has(acc.id);
      keyboard.text(
         `${isRunning ? "🟢" : "⚫"} ${acc.label}`,
         `ctrl:toggle_${acc.id}`
      );
      if (i % 2 === 1) keyboard.row();
   });

   keyboard.row()
      .text("⏹️ Stop Semua", "ctrl:stopall")
      .text("ℹ️ Status", "ctrl:status")
      .row()
      .text(
         autoFallback ? "🔁 Auto-switch: ON" : "🔁 Auto-switch: OFF",
         "ctrl:togglefallback"
      );

   await bot.api
      .sendMessage(OWNER_ID, "🎮 Kontrol Userbot:", { reply_markup: keyboard })
      .catch(console.error);
}

bot.command("menu", async (ctx) => {
   if (ctx.from?.id !== OWNER_ID) return ctx.reply("❌ Tidak diizinkan.");
   await sendControlKeyboard();
});

bot.command("status", async (ctx) => {
   if (ctx.from?.id !== OWNER_ID) return ctx.reply("❌ Tidak diizinkan.");
   const lines = ACCOUNTS.map(acc =>
      `${processes.has(acc.id) ? "🟢" : "🔴"} ${acc.label}`
   );
   lines.push(`\n🔁 Auto-switch: ${autoFallback ? "ON" : "OFF"}`);
   ctx.reply(lines.join("\n"));
});

bot.callbackQuery(/^ctrl:toggle_(\d+)$/, async (ctx) => {
   await ctx.answerCallbackQuery();
   const accountId = parseInt(ctx.match[1]);
   if (processes.has(accountId)) {
      await stopAccount(accountId);
   } else {
      await startAccount(accountId);
   }
});

bot.callbackQuery("ctrl:stopall", async (ctx) => {
   await ctx.answerCallbackQuery();
   await stopAll();
   await notify("🛑 Semua akun dihentikan.");
});

bot.callbackQuery("ctrl:status", async (ctx) => {
   await ctx.answerCallbackQuery();
   const lines = ACCOUNTS.map(acc =>
      `${processes.has(acc.id) ? "🟢" : "🔴"} ${acc.label}`
   );
   lines.push(`\n🔁 Auto-switch: ${autoFallback ? "ON" : "OFF"}`);
   try {
      await ctx.editMessageText(lines.join("\n"));
   } catch {
      await ctx.reply(lines.join("\n"));
   }
});

bot.callbackQuery("ctrl:togglefallback", async (ctx) => {
   await ctx.answerCallbackQuery();
   autoFallback = !autoFallback;
   await notify(`🔁 Auto-switch sekarang: ${autoFallback ? "ON" : "OFF"}`);
   await sendControlKeyboard();
});

(async () => {
   await bot.api.setMyCommands([
      { command: "menu", description: "Tampilkan kontrol semua akun" },
      { command: "status", description: "Cek status semua akun" },
   ]).catch(console.error);

   bot.start();
   console.log("🎮 Controller bot aktif!");
})();