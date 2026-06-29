import { ChildProcess, spawn } from "child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { Bot } from "grammy";
import { ACCOUNTS } from "./account";

export const processes = new Map<number, ChildProcess>();

export function getPidFile(accountId: number) {
   return `./userbot-${accountId}.pid`;
}

export async function startAccount(
   bot: Bot,
   ownerId: number,
   accountId: number,
   isAuto = false,
   autoFallback = { value: true },
   targetUsername = "chatbot"
) {
   const account = ACCOUNTS.find(a => a.id === accountId);
   if (!account) {
      await bot.api.sendMessage(ownerId, `❌ Akun ${accountId} tidak ditemukan.`);
      return;
   }

   if (processes.has(accountId)) {
      await bot.api.sendMessage(ownerId, `⚠️ ${account.label} sudah berjalan.`);
      return;
   }

   const envPath = `.env.account${accountId}`;
   writeFileSync(envPath, `SESSION_STRING=${account.SESSION_STRING}\n`);

   const staggerDelay = (accountId - 1) * 8000;
   await new Promise(r => setTimeout(r, staggerDelay));

   const proc = spawn("npx", [
      "ts-node", "src/index.ts"
   ], {
      stdio: "pipe",
      shell: true,
      env: {
         ...process.env,
         ACCOUNT_ID: String(accountId),
         SESSION_STRING: account.SESSION_STRING,
         TARGET_USERNAME: targetUsername,
      }
   });


   proc.stderr?.on("data", (data: Buffer) => {
      const log = data.toString().trim();
      console.error(`[${account.label}] STDERR: ${log}`);
      bot.api.sendMessage(ownerId, `[${account.label}] ❌ ${log}`).catch(console.error);
   });

   proc.stdout?.on("data", (data: Buffer) => {
      const log = data.toString().trim();
      console.log(`[${account.label}] ${log}`);
      if (["✅", "🔄", "⏰", "❓"].some(e => log.includes(e))) {
         bot.api.sendMessage(ownerId, `[${account.label}] ${log}`).catch(console.error);
      }
   });

   proc.on("exit", async (code) => {
      const wasRunning = processes.has(accountId);
      processes.delete(accountId);
      try { unlinkSync(getPidFile(accountId)); } catch {}
      if (wasRunning) {
         await bot.api.sendMessage(ownerId, `⚠️ ${account.label} berhenti tidak terduga (exit code: ${code})`);
         if (autoFallback.value) await tryFallback(bot, ownerId, accountId, autoFallback);
      }
   });

   processes.set(accountId, proc);
   const label = isAuto ? `🔄 Auto-switch ke ${account.label}` : `✅ ${account.label} berhasil dijalankan!`;
   await bot.api.sendMessage(ownerId, label);
}

export async function stopAccount(bot: Bot, ownerId: number, accountId: number) {
   const account = ACCOUNTS.find(a => a.id === accountId);
   const proc = processes.get(accountId);

   if (!proc) {
      await bot.api.sendMessage(ownerId, `⚠️ ${account?.label ?? `Akun ${accountId}`} tidak sedang berjalan.`);
      return;
   }

   processes.delete(accountId);
   const pidFile = `./userbot-${accountId}.pid`;

   try {
      if (existsSync(pidFile)) {
         const pid = parseInt(readFileSync(pidFile, "utf-8").trim());
         unlinkSync(pidFile);
         spawn("taskkill", ["/PID", String(pid), "/T", "/F"], { shell: true });
      }
   } catch {}

   try { proc.kill("SIGKILL"); } catch {}

   await bot.api.sendMessage(ownerId, `🛑 ${account?.label} dihentikan.`);
}

export async function stopAll(bot: Bot, ownerId: number) {
   for (const acc of ACCOUNTS) {
      if (processes.has(acc.id)) await stopAccount(bot, ownerId, acc.id);
   }
}

export async function tryFallback(
   bot: Bot,
   ownerId: number,
   failedAccountId: number,
   autoFallback: { value: boolean }
) {
   const nextAccount = ACCOUNTS.find(a => a.id !== failedAccountId && !processes.has(a.id));
   if (!nextAccount) {
      await bot.api.sendMessage(ownerId, "❌ Semua akun sudah dicoba atau sedang berjalan. Tidak ada fallback.");
      return;
   }
   await bot.api.sendMessage(ownerId, `🔁 Mencoba fallback ke ${nextAccount.label}...`);
   await startAccount(bot, ownerId, nextAccount.id, true, autoFallback);
}