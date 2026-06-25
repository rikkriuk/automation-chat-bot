import { Bot, InlineKeyboard } from "grammy";
import { ACCOUNTS } from "../services/account";
import { processes } from "../services/process";

export async function sendControlKeyboard(bot: Bot, ownerId: number, autoFallback: { value: boolean }) {
   const keyboard = new InlineKeyboard();

   ACCOUNTS.forEach((acc, i) => {
      const isRunning = processes.has(acc.id);
      keyboard.text(`${isRunning ? "🟢" : "⚫"} ${acc.label}`, `ctrl:toggle_${acc.id}`);
      if (i % 2 === 1) keyboard.row();
   });

   keyboard.row()
      .text("⏹️ Stop Semua", "ctrl:stopall")
      .text("ℹ️ Status", "ctrl:status")
      .row()
      .text(autoFallback.value ? "🔁 Auto-switch: ON" : "🔁 Auto-switch: OFF", "ctrl:togglefallback");

   await bot.api.sendMessage(ownerId, "🎮 Kontrol Userbot:", { reply_markup: keyboard });
}