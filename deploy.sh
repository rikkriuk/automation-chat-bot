set -e

echo "🚀 Deploying automation-telegram-bot..."

echo "📦 Pulling from master..."
git pull origin master

echo "📥 Installing dependencies..."
npm install

echo "🔄 Restarting automation-chat-bot..."
if pm2 list | grep -q "automation-chat-bot"; then
   pm2 restart automation-chat-bot
else
   pm2 start "npm run bot" --name "automation-chat-bot"
fi

pm2 save

echo "✅ Deploy selesai!"
pm2 status