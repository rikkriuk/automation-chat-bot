set -e

echo "🚀 Deploying automation-telegram-bot..."

echo "📦 Pulling from master..."
git pull origin master

echo "📥 Installing dependencies..."
npm install

echo "🔄 Restarting controller..."
if pm2 list | grep -q "controller"; then
   pm2 restart controller
else
   pm2 start "npm run controller" --name "controller"
fi

pm2 save

echo "✅ Deploy selesai!"
pm2 status