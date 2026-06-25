import { Bot } from "grammy";
import { handleWizardInput, isInWizard } from "./session-wizard";

export function registerMessages(
   bot: Bot,
   ownerId: number,
   autoFallback: { value: boolean }
) {
   bot.on("message:text", async (ctx) => {
      if (ctx.from?.id !== ownerId) return;
      const text = ctx.message.text.trim();

      if (isInWizard(ownerId)) {
         await handleWizardInput(ownerId, text);
         return;
      }
   });
}