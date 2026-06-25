import { Bot } from "grammy";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { getNextSessionIndex, readEnv, reloadAccounts, writeEnv } from "../services/account";
import { sendControlKeyboard } from "./keyboard";

interface WizardState {
   step: "phone" | "code" | "password";
   client: TelegramClient;
   resolvers: {
      phone: Promise<string>;
      code: Promise<string>;
      password: Promise<string>;
   };
   resolve: {
      phone: (v: string) => void;
      code: (v: string) => void;
      password: (v: string) => void;
   };
}

const wizardStates = new Map<number, WizardState>();

export function isInWizard(ownerId: number) {
   return wizardStates.has(ownerId);
}

export async function startSessionWizard(bot: Bot, ownerId: number, autoFallback: { value: boolean }) {
   const env = readEnv();
   const apiId = parseInt(env.API_ID || "");
   const apiHash = env.API_HASH || "";

   if (!apiId || !apiHash) {
      await bot.api.sendMessage(ownerId, "❌ API\\_ID atau API\\_HASH tidak ditemukan di `.env`.");
      return;
   }

   const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
      connectionRetries: 5,
   });

   let resolvePhone: (v: string) => void;
   let resolveCode: (v: string) => void;
   let resolvePassword: (v: string) => void;

   wizardStates.set(ownerId, {
      step: "phone",
      client,
      resolvers: {
         phone: new Promise<string>(r => { resolvePhone = r; }),
         code: new Promise<string>(r => { resolveCode = r; }),
         password: new Promise<string>(r => { resolvePassword = r; }),
      },
      resolve: {
         phone: (v: string) => resolvePhone(v),
         code: (v: string) => resolveCode(v),
         password: (v: string) => resolvePassword(v),
      }
   });

   await bot.api.sendMessage(ownerId, "📱 Masukkan nomor HP akun Telegram (+62...):");

   client.start({
      phoneNumber: async () => {
         const phone = await wizardStates.get(ownerId)!.resolvers.phone;
         wizardStates.get(ownerId)!.step = "code";
         await bot.api.sendMessage(ownerId, "⏳ Menghubungi Telegram, mengirim kode OTP...");
         return phone;
      },
      phoneCode: async () => {
         await bot.api.sendMessage(ownerId, "📨 Masukkan kode OTP yang diterima:");
         const code = await wizardStates.get(ownerId)!.resolvers.code;
         wizardStates.get(ownerId)!.step = "password";
         return code;
      },
      password: async () => {
         await bot.api.sendMessage(ownerId, "🔐 Akun ini menggunakan 2FA. Masukkan password:");
         return await wizardStates.get(ownerId)!.resolvers.password;
      },
      onError: async (err): Promise<boolean> => {
         await bot.api.sendMessage(ownerId, `❌ Error: ${err.message}`);
         wizardStates.delete(ownerId);
         return false;
      },
   }).then(async () => {
      await finishWizard(bot, ownerId, autoFallback, client);
   }).catch(async (err) => {
      await bot.api.sendMessage(ownerId, `❌ Gagal login: ${err.message}`);
      wizardStates.delete(ownerId);
   });
}

export async function handleWizardInput(ownerId: number, text: string) {
   const state = wizardStates.get(ownerId);
   if (!state) return;

   state.resolve[state.step]?.(text.trim());
}

async function finishWizard(
   bot: Bot,
   ownerId: number,
   autoFallback: { value: boolean },
   client: TelegramClient
) {
   const sessionString = client.session.save() as unknown as string;
   await client.disconnect();
   wizardStates.delete(ownerId);

   const env = readEnv();
   const index = getNextSessionIndex(env);
   const key = `SESSION_${index}`;

   env[key] = sessionString;
   writeEnv(env);
   reloadAccounts();

   await bot.api.sendMessage(ownerId, `✅ Akun berhasil ditambahkan sebagai *Akun ${index}*`, { parse_mode: "Markdown" });
   await sendControlKeyboard(bot, ownerId, autoFallback);
}