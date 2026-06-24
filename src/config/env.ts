import dotenv from "dotenv";
import fs from "fs";
import readline from "readline";

dotenv.config();

export const requiredEnv: Record<string, string> = {
   API_ID: process.env.API_ID || "",
   API_HASH: process.env.API_HASH || "",
   SESSION_STRING: process.env.SESSION_STRING || "",
   TARGET_USERNAME: process.env.TARGET_USERNAME || "",
};

export async function setupEnv(): Promise<Record<string, string>> {
   const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
   const question = (q: string): Promise<string> => new Promise(res => rl.question(q, res));

   for (const [key, value] of Object.entries(requiredEnv)) {
      if (!value.trim()) {
         const answer = await question(`Masukkan ${key}: `);
         requiredEnv[key] = answer.trim();
      }
   }

   fs.writeFileSync(".env", Object.entries(requiredEnv).map(([k, v]) => `${k}=${v}`).join("\n"));
   console.log("✅ .env tersimpan!");
   rl.close();
   return requiredEnv;
}