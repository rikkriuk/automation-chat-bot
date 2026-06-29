import { Bot, InlineKeyboard } from "grammy";
import { ACCOUNTS, readEnv, reloadAccounts, writeEnv } from "../services/account";
import { processes, startAccount, stopAccount, stopAll } from "../services/process";
import { sendControlKeyboard } from "./keyboard";
import { BOT_TARGETS } from "../config/bots";

export function registerCallbacks(
   bot: Bot,
   ownerId: number,
   autoFallback: { value: boolean }
) {
   bot.callbackQuery(/^ctrl:toggle_(\d+)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const accountId = parseInt(ctx.match[1]);

      if (processes.has(accountId)) {
         await stopAccount(bot, ownerId, accountId);
         await sendControlKeyboard(bot, ownerId, autoFallback);
         return;
      }

      const keyboard = new InlineKeyboard();
      BOT_TARGETS.forEach(b => {
         keyboard.text(`🤖 ${b.label}`, `start:${accountId}:${b.username}`).row();
      });
      keyboard.text("❌ Batal", "ctrl:cancel");

      await bot.api.sendMessage(ownerId, `Akun ${accountId} → pilih target bot:`, {
         reply_markup: keyboard
      });
   });

   bot.callbackQuery(/^start:(\d+):(.+)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const accountId = parseInt(ctx.match[1]);
      const targetUsername = ctx.match[2];

      await startAccount(bot, ownerId, accountId, false, autoFallback, targetUsername);
      await sendControlKeyboard(bot, ownerId, autoFallback);
   });

   bot.callbackQuery("ctrl:cancel", async (ctx) => {
      await ctx.answerCallbackQuery();
      await ctx.deleteMessage();
   });

   bot.callbackQuery("ctrl:stopall", async (ctx) => {
      await ctx.answerCallbackQuery();
      await stopAll(bot, ownerId);
      await bot.api.sendMessage(ownerId, "🛑 Semua akun dihentikan.");
   });

   bot.callbackQuery("ctrl:status", async (ctx) => {
      await ctx.answerCallbackQuery();
      const lines = ACCOUNTS.map(acc => `${processes.has(acc.id) ? "🟢" : "🔴"} ${acc.label}`);
      lines.push(`\n🔁 Auto-switch: ${autoFallback.value ? "ON" : "OFF"}`);
      try {
         await ctx.editMessageText(lines.join("\n"));
      } catch {
         await ctx.reply(lines.join("\n"));
      }
   });

   bot.callbackQuery("ctrl:togglefallback", async (ctx) => {
      await ctx.answerCallbackQuery();
      autoFallback.value = !autoFallback.value;
      await bot.api.sendMessage(ownerId, `🔁 Auto-switch sekarang: ${autoFallback.value ? "ON" : "OFF"}`);
      await sendControlKeyboard(bot, ownerId, autoFallback);
   });

   bot.callbackQuery(/^remove:(\d+)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const accountId = parseInt(ctx.match[1]);
      const account = ACCOUNTS.find(a => a.id === accountId);
      if (!account) return ctx.reply("❌ Akun tidak ditemukan.");

      if (processes.has(accountId)) await stopAccount(bot, ownerId, accountId);

      const env = readEnv();
      const keyToDelete = `SESSION_${accountId}`;
      if (env[keyToDelete]) {
         delete env[keyToDelete];
         writeEnv(env);
         reloadAccounts();
         await bot.api.sendMessage(ownerId, `🗑️ ${account.label} berhasil dihapus.`);
         await sendControlKeyboard(bot, ownerId, autoFallback);
      }
   });
}