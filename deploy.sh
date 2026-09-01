#!/bin/bash

set -e

APP_DIR=/var/www/shahcoffee
cd "$APP_DIR"

echo "=== Deploy shahcoffee ==="
echo "1. Обновляем код..."
git pull --ff-only origin main

echo "2. Устанавливаем зависимости..."
npm ci

echo "3. Собираем проект..."
npm run build

echo "4. Удаляем dev-зависимости..."
npm prune --omit=dev

echo "5. Перезапускаем backend..."
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart shahcoffee
  pm2 save
fi

echo "6. Проверяем и перезагружаем nginx..."
nginx -t
systemctl reload nginx

echo "Deploy завершен"
