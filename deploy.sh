#!/bin/bash
set -e
cd ~/vedaneri-app
git pull origin main
npm install --include=dev
npm run build --workspace @vedaneri/api
npm run build --workspace @vedaneri/web
(cd apps/cms && npx vite build)
cp -r apps/cms/dist/* /home/admin-vedaneri/htdocs/admin-vedaneri.divasprik.in/ 2>/dev/null || echo "CMS copy needs root, see note"
pm2 reload ecosystem.config.cjs --update-env
pm2 save
echo "Deployed"