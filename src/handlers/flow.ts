import { TelegramClient, Api } from "telegram";
import { state, resetState, startReplyTimeout, clearReplyTimeout } from "../state";
import { MALE_KEYWORDS, FEMALE_KEYWORDS, MALE_RESPONSES, FEMALE_RESPONSES, ASK_GENDER } from "../config/triggers";

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export async function sendWithDelay(
  client: TelegramClient,
  username: string,
  message: string,
  delay: number = 1500
) {
   if (state.chatAborted) {
      console.log(`⚠️ Kirim dibatalkan (chat sudah berakhir): "${message}"`);
      return;
   }
   await sleep(delay + Math.random() * 900);
   if (state.chatAborted) {
      console.log(`⚠️ Kirim dibatalkan setelah delay: "${message}"`);
      return;
   }
   await client.sendMessage(username, { message, parseMode: "markdown" });
}

export async function handlePartnerFound(client: TelegramClient, username: string) {
   if (state.isProcessing) return;

   state.isProcessing = true;
   state.chatAborted = false;
   state.currentStep = 1;

   await sendWithDelay(client, username, "co", 1000);
   const randomAsk = ASK_GENDER[Math.floor(Math.random() * ASK_GENDER.length)];
   console.log(`✅ Partner found → Kirim '${randomAsk}'`);
   await sendWithDelay(client, username, randomAsk, 1500);
   startReplyTimeout(client, username);
}

export async function processUserReply(
  client: TelegramClient,
  text: string,
  username: string
) {
   if (!state.isProcessing || !text) return;
   if (state.chatAborted) return;

   clearReplyTimeout();

   const lower = text.toLowerCase().trim();
   console.log(`[Step ${state.currentStep}] User: ${text}`);

   if (state.currentStep === 1) {
      await handleGenderStep(client, username, lower);
      return;
   }

   if (state.currentStep === 2) {
      await handleAgeStep(client, username, lower);
      return;
   }
}

async function handleGenderStep(client: TelegramClient, username: string, lower: string) {
   if (MALE_KEYWORDS.some(kw => lower.includes(kw))) {
      const randomResponse = MALE_RESPONSES[Math.floor(Math.random() * MALE_RESPONSES.length)];

      console.log("👨 Cowok → Skip");

      await sendWithDelay(client, username, randomResponse, 1000);
      await new Promise(r => setTimeout(r, 1200));

      if (state.chatAborted) { resetState(); return; }

      await sendWithDelay(client, username, "/next");
      resetState();
      return;
   }

   if (FEMALE_KEYWORDS.some(kw => lower.includes(kw))) {
      const randomResponse = FEMALE_RESPONSES[Math.floor(Math.random() * FEMALE_RESPONSES.length)];
      state.currentStep = 2;

      await sendWithDelay(client, username, randomResponse, 1000);
      await new Promise(r => setTimeout(r, 800));

      if (state.chatAborted) { resetState(); return; }

      await sendWithDelay(client, username, "umur brp?", 1400);
      if (state.chatAborted) { resetState(); return; }

      startReplyTimeout(client, username);
      return;
   }

   console.log("❓ Keyword tidak valid → Skip");
   if (state.chatAborted) { resetState(); return; }
   await sendWithDelay(client, username, "/next", 1000);
   resetState();
}

async function handleAgeStep(client: TelegramClient, username: string, lower: string) {
   const ageMatch = lower.match(/\b(\d{1,2})\b/);

   if (ageMatch) {
      const age = parseInt(ageMatch[1]);
      if (age < 12) {
         console.log("👶 Umur < 12 → Skip");
         await sendWithDelay(client, username, "oke", 900);
         await new Promise(r => setTimeout(r, 1000));
         if (state.chatAborted) { resetState(); return; }
         await sendWithDelay(client, username, "/next");
         resetState();
         return;
      }
   }

   if (state.chatAborted) { resetState(); return; }
   await goToHi(client, username);
}

async function goToHi(client: TelegramClient, username: string) {
   state.currentStep = 3;

   await sendWithDelay(client, username, "Bot buat kirim stiker tele jadi stiker whatsapp, kali aja butuh", 1600);
   await sendWithDelay(client, username, "@SendStickerBot", 500);
   if (state.chatAborted) { resetState(); return; }

   await sendWithDelay(client, username, "/stop", 500);
   await new Promise(r => setTimeout(r, 2500));
   if (state.chatAborted) { resetState(); return; }

   await sendWithDelay(client, username, "/next", 1400);
   resetState();
}

async function sendAgePromptWithSticker(client: TelegramClient, username: string) {
   try {
      const res: any = await client.invoke(new Api.messages.GetStickerSet({
         stickerset: new Api.InputStickerSetShortName({ shortName: "Dino_kuning_by_fStikBot" }),
         hash: 0,
      }));

      const docs = (res as any).documents;
      const stickerDoc = Array.isArray(docs) && docs[1];
      if (stickerDoc) {
         try {
            await client.sendMessage(username, { file: stickerDoc });
            await new Promise(r => setTimeout(r, 400));
         } catch (e) {
            console.error("Gagal kirim sticker, lanjut kirim teks:", e);
         }
      }
   } catch (e) {
      console.error("Gagal ambil sticker pack, lanjut kirim teks:", e);
   }

   await sendWithDelay(client, username, "Umur brp?", 1400);
}