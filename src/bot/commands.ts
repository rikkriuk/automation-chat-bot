import { Bot, InlineKeyboard } from "grammy";
import { ACCOUNTS } from "../services/account";
import { processes } from "../services/process";
import { sendControlKeyboard } from "./keyboard";
import { startSessionWizard } from "./session-wizard";

export function registerCommands(
   bot: Bot,
   ownerId: number,
   autoFallback: { value: boolean }
) {
   bot.command("menu", async (ctx) => {
      if (ctx.from?.id !== ownerId) return ctx.reply("❌ Tidak diizinkan.");
      await sendControlKeyboard(bot, ownerId, autoFallback);
   });

   bot.command("status", async (ctx) => {
      if (ctx.from?.id !== ownerId) return ctx.reply("❌ Tidak diizinkan.");
      const lines = ACCOUNTS.map(acc => `${processes.has(acc.id) ? "🟢" : "🔴"} ${acc.label}`);
      lines.push(`\n🔁 Auto-switch: ${autoFallback.value ? "ON" : "OFF"}`);
      ctx.reply(lines.join("\n"));
   });

   bot.command("addaccount", async (ctx) => {
      if (ctx.from?.id !== ownerId) return ctx.reply("❌ Tidak diizinkan.");
      await startSessionWizard(bot, ownerId, autoFallback);
   });

   bot.command("removeaccount", async (ctx) => {
      if (ctx.from?.id !== ownerId) return ctx.reply("❌ Tidak diizinkan.");
      if (ACCOUNTS.length === 0) return ctx.reply("❌ Tidak ada akun tersimpan.");

      const keyboard = new InlineKeyboard();
      ACCOUNTS.forEach(acc => {
         const isRunning = processes.has(acc.id);
         keyboard.text(`${isRunning ? "🟢" : "⚫"} ${acc.label}`, `remove:${acc.id}`).row();
      });
      await ctx.reply("🗑️ Pilih akun yang ingin dihapus:", { reply_markup: keyboard });
   });
}