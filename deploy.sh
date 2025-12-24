#!/bin/bash

# Deploy скрипт для shahcoffee проекта

set -e

echo "=== Deploy shahcoffee ==="

# 1. Обновляем код из репозитория
echo "1. Обновляем код..."
cd /var/www/shahcoffee
git pull origin main

# 2. Устанавливаем зависимости
echo "2. Устанавливаем зависимости..."
npm ci --omit=dev

# 3. Собираем React проект
echo "3. Собираем проект..."
npm run build

# 4. Перезапускаем Node.js сервер (используем PM2 или systemctl)
echo "4. Перезапускаем сервер..."

# Вариант 1: Если используется PM2
if command -v pm2 &> /dev/null; then
    pm2 restart shahcoffee
    echo "✓ PM2 restarted"
fi

# Вариант 2: Если используется systemctl
# sudo systemctl restart shahcoffee

# 5. Проверяем nginx конфиг и перезагружаем
echo "5. Проверяем и перезагружаем nginx..."
sudo nginx -t
sudo systemctl reload nginx

echo "✓ Deploy успешно завершен!"
echo "Frontend: /var/www/shahcoffee/dist"
echo "Backend: localhost:3001"
