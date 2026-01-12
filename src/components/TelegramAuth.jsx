import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function TelegramAuth() {
  const { loginWithTelegram } = useAuth();

  useEffect(() => {
    // Инициализируем Telegram Web App
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-web-app.js';
    script.async = true;
    document.body.appendChild(script);

    script.onload = () => {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.ready();
        
        // Получаем данные пользователя из Telegram
        const initData = window.Telegram.WebApp.initData;
        const user = window.Telegram.WebApp.initDataUnsafe?.user;

        if (user) {
          loginWithTelegram({
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name || '',
            username: user.username || '',
            photo_url: user.photo_url || '',
            is_bot: user.is_bot,
            is_premium: user.is_premium,
          });
        }
      }
    };

    return () => {
      document.body.removeChild(script);
    };
  }, [loginWithTelegram]);

  return null;
}
