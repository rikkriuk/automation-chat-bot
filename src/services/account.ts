import { existsSync, readFileSync, writeFileSync } from "fs";

export interface Account {
   id: number;
   SESSION_STRING: string;
   label: string;
}

export function readEnv(): Record<string, string> {
   if (!existsSync(".env")) return {};
   const content = readFileSync(".env", "utf-8");
   const result: Record<string, string> = {};
   for (const line of content.split("\n")) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) result[match[1].trim()] = match[2].trim();
   }
   return result;
}

export function writeEnv(env: Record<string, string>) {
   const lines = Object.entries(env).map(([k, v]) => `${k}=${v}`);
   writeFileSync(".env", lines.join("\n") + "\n");
}

export function getNextSessionIndex(env: Record<string, string>): number {
   let i = 1;
   while (env[`SESSION_${i}`]) i++;
   return i;
}

function parseAccounts(env: Record<string, string>): Account[] {
   return Object.keys(env)
      .filter(k => /^SESSION_\d+$/.test(k))
      .sort((a, b) => parseInt(a.replace("SESSION_", "")) - parseInt(b.replace("SESSION_", "")))
      .map(key => ({
         id: parseInt(key.replace("SESSION_", "")),
         SESSION_STRING: env[key],
         label: `Akun ${key.replace("SESSION_", "")}`,
      }))
      .filter(acc => acc.SESSION_STRING);
}

export const ACCOUNTS: Account[] = parseAccounts(readEnv());

export function reloadAccounts() {
   const newAccounts = parseAccounts(readEnv());
   ACCOUNTS.length = 0;
   ACCOUNTS.push(...newAccounts);
}