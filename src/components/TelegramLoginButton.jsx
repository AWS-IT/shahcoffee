import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function TelegramLoginButton() {
  const { user, logout, loginWithTelegram } = useAuth();
  const containerRef = useRef(null);
  const [widgetLoaded, setWidgetLoaded] = useState(false);

  useEffect(() => {
    // Проверяем, не загружен ли уже виджет
    if (!containerRef.current || user) return;

    // Очищаем контейнер перед добавлением нового виджета
    containerRef.current.innerHTML = '';

    // Создаём callback функцию для обработки авторизации
    window.onTelegramAuth = async (telegramUser) => {
      console.log('Telegram auth callback:', telegramUser);
      
      try {
        // Отправляем данные на сервер для верификации
        const response = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(telegramUser),
        });

        const data = await response.json();
        
        if (data.success) {
          loginWithTelegram(data.user, data.token);
        } else {
          console.error('Ошибка авторизации:', data.error);
        }
      } catch (error) {
        console.error('Ошибка при авторизации:', error);
        // Fallback - сохраняем локально без верификации на сервере
        loginWithTelegram({
          id: telegramUser.id,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name || '',
          username: telegramUser.username || '',
          photo_url: telegramUser.photo_url || '',
        });
      }
    };

    // Создаём скрипт Telegram Widget
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', 'shahcoffee_bot');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '10');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;
    
    script.onload = () => {
      setWidgetLoaded(true);
    };

    containerRef.current.appendChild(script);

    // Таймаут для fallback
    const timeout = setTimeout(() => {
      if (!widgetLoaded) {
        setWidgetLoaded(true); // Показываем fallback
      }
    }, 3000);

    return () => {
      // Cleanup
      delete window.onTelegramAuth;
      clearTimeout(timeout);
    };
  }, [user, loginWithTelegram]);

  // Проверяем Telegram Web App (если открыто внутри Telegram)
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const webApp = window.Telegram.WebApp;
      webApp.ready();
      
      const tgUser = webApp.initDataUnsafe?.user;
      if (tgUser && !user) {
        loginWithTelegram({
          id: tgUser.id,
          first_name: tgUser.first_name,
          last_name: tgUser.last_name || '',
          username: tgUser.username || '',
          photo_url: tgUser.photo_url || '',
        });
      }
    }
  }, [user, loginWithTelegram]);

  if (user) {
    return (
      <div className="telegram-user-info">
        {user.photo_url && (
          <img src={user.photo_url} alt="Avatar" className="user-avatar" />
        )}
        <span className="user-name">{user.first_name}</span>
        <button onClick={logout} className="logout-btn">Выход</button>
      </div>
    );
  }

  return (
    <div className="telegram-login">
      {/* Контейнер для Telegram виджета */}
      <div ref={containerRef}></div>

      <style>{`
        .telegram-login {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .telegram-user-info {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 16px;
          background: linear-gradient(135deg, #0088cc 0%, #006699 100%);
          border-radius: 8px;
          color: white;
        }

        .user-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid rgba(255, 255, 255, 0.3);
        }

        .user-name {
          font-weight: 600;
          color: white;
        }

        .logout-btn {
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.3s ease;
          font-weight: 600;
        }

        .logout-btn:hover {
          background: rgba(255, 255, 255, 0.3);
          border-color: rgba(255, 255, 255, 0.5);
        }

        @media (max-width: 768px) {
          .telegram-user-info {
            padding: 6px 12px;
            gap: 8px;
          }

          .user-avatar {
            width: 28px;
            height: 28px;
          }

          .user-name {
            font-size: 14px;
          }

          .logout-btn {
            padding: 4px 8px;
            font-size: 11px;
          }
        }
      `}</style>
    </div>
  );
}
