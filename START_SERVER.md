# Инструкция по запуску Node.js приложения на REG.RU

## Шаг 1: Запустите приложение в фоновом режиме

```bash
# Перейдите в папку проекта
cd ~/shahcoffee

# Запустите приложение через nohup
nohup node server.js > server.log 2>&1 &

# Проверьте, что процесс запустился
ps aux | grep server.js

# Проверьте порт
netstat -tlnp | grep 3001
# Или
ss -tlnp | grep 3001

# Посмотрите логи
tail -f server.log
```

## Шаг 2: Настройте Nginx прокси

### Вариант А: Через панель управления (рекомендуется)

1. Войдите в панель ISPmanager на https://www.reg.ru
2. Найдите раздел "WWW" → "Домены" или "Node.js"
3. Создайте прокси для вашего IP/домена на порт 3001

### Вариант Б: Через тикет в поддержку

Отправьте файл `u3358557_proxy.conf` в поддержку REG.RU с текстом:

```
Тема: Настройка Nginx прокси для Node.js приложения

Здравствуйте!

Прошу установить конфигурацию Nginx для моего Node.js приложения.

Детали:
- Пользователь: u3358557
- IP: 37.140.192.62
- Приложение запущено на порту 3001
- Путь к проекту: /home/u3358557/shahcoffee

Прикладываю файл конфигурации u3358557_proxy.conf, который нужно поместить в /etc/nginx/conf.d/

После установки конфигурации прошу выполнить:
nginx -t && systemctl reload nginx

Спасибо!
```

### Вариант В: Если есть доступ к загрузке конфигов

Некоторые панели позволяют загружать конфиги:

```bash
# Проверьте, есть ли у вас доступ к папке конфигов
ls -la /home/u3358557/.nginx/
# или
ls -la ~/nginx/

# Если есть доступ, скопируйте туда конфиг
cp ~/shahcoffee/u3358557_proxy.conf ~/.nginx/
```

## Шаг 3: Автоматический перезапуск при падении

Создайте скрипт для мониторинга:

```bash
# Создайте файл keeper.sh
nano ~/shahcoffee/keeper.sh
```

Содержимое файла:

```bash
#!/bin/bash
cd /home/u3358557/shahcoffee
while true; do
    if ! pgrep -f "node server.js" > /dev/null; then
        echo "$(date): Restarting server..." >> keeper.log
        nohup node server.js > server.log 2>&1 &
    fi
    sleep 60
done
```

Запустите keeper:

```bash
chmod +x ~/shahcoffee/keeper.sh
nohup ~/shahcoffee/keeper.sh > ~/shahcoffee/keeper.log 2>&1 &
```

## Полезные команды

### Проверка статуса

```bash
# Список процессов Node.js
ps aux | grep node

# Проверка порта
netstat -tlnp | grep 3001

# Логи приложения
tail -f ~/shahcoffee/server.log

# Логи keeper
tail -f ~/shahcoffee/keeper.log
```

### Остановка приложения

```bash
# Найти PID процесса
ps aux | grep server.js

# Остановить по PID (замените 12345 на реальный PID)
kill 12345

# Или остановить все процессы Node.js
pkill -f "node server.js"

# Остановить keeper
pkill -f "keeper.sh"
```

### Перезапуск после изменений

```bash
# Остановить приложение
pkill -f "node server.js"

# Собрать проект
cd ~/shahcoffee
npm run build

# Запустить снова
nohup node server.js > server.log 2>&1 &
```

## Проверка работы

После настройки Nginx:

1. **Главная страница:** http://37.140.192.62/
2. **Админка:** http://37.140.192.62/admin
3. **API проверка:** http://37.140.192.62/health

## Возможные проблемы

### Порт уже занят

```bash
# Найти процесс на порту 3001
netstat -tlnp | grep 3001

# Убить процесс
kill -9 PID_процесса
```

### Приложение не запускается

```bash
# Проверьте логи
cat ~/shahcoffee/server.log

# Проверьте .env файл
cat ~/shahcoffee/.env

# Проверьте права на файлы
ls -la ~/shahcoffee/
```

### Nginx не перезагружается

```bash
# Проверьте конфигурацию через панель управления или тикет в поддержку
# У вас нет прав на nginx напрямую
```

## После настройки

Когда все заработает, не забудьте:
1. ✅ Проверить все страницы сайта
2. ✅ Проверить админку
3. ✅ Настроить автозапуск через keeper.sh
4. ✅ Проверить логи на ошибки
