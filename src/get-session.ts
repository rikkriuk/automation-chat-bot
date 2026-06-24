import readline from "readline/promises";

const rl = readline.createInterface({
   input: process.stdin,
   output: process.stdout,
});

const question = (query: string): Promise<string> => 
   rl.question(query);

(async () => {
   console.log("=== Generate Telegram Session String ===\n");

   const apiIdInput = await question("Masukkan API_ID: ");
   const apiId = parseInt(apiIdInput);
   const apiHash = await question("Masukkan API_HASH: ");

   if (!apiId || !apiHash) {
      console.error("❌ API_ID atau API_HASH tidak valid!");
      rl.close();
      process.exit(1);
   }

   const { TelegramClient } = await import("telegram");
   const { StringSession } = await import("telegram/sessions");

   const client = new TelegramClient(
      new StringSession(""), 
      apiId, 
      apiHash,
      { connectionRetries: 5 }
   );

   try {
      await client.start({
         phoneNumber: async () => await question("Masukkan nomor HP (+62...): "),
         password: async () => await question("Password 2FA (kosongkan jika tidak ada): "),
         phoneCode: async () => await question("Masukkan kode OTP dari Telegram: "),
         onError: (err: any) => console.log("Error:", err),
      });

      const sessionString = client.session.save() as unknown as string;

      console.log("\n✅ SESSION_STRING BERHASIL DIDAPATKAN:");
      console.log("\n" + sessionString);
      console.log("\nSalin string di atas dan masukkan ke file .env kamu.");

   } catch (error) {
      console.error("❌ Gagal login:", error);
   } finally {
      await client.disconnect();
      rl.close();
   }
})();