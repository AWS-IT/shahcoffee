import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Загружаем данные из localStorage при монтировании
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        if (savedToken) {
          setToken(savedToken);
        }
      } catch (e) {
        console.error('Ошибка загрузки пользователя:', e);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  // Авторизация через Telegram
  const loginWithTelegram = (userData, authToken = null) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    
    if (authToken) {
      setToken(authToken);
      localStorage.setItem('token', authToken);
    }
  };

  // Регистрация по email/паролю
  const register = async (email, password, firstName, phone) => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, firstName, phone }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Ошибка регистрации');
    }
    
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('token', data.token);
    
    return data;
  };

  // Вход по email/паролю
  const login = async (email, password) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Ошибка входа');
    }
    
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('token', data.token);
    
    return data;
  };

  // Выход
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('pendingOrder');
  };

  // Привязка Telegram к аккаунту
  const linkTelegram = async (telegramData) => {
    if (!token) {
      throw new Error('Необходимо войти в аккаунт');
    }
    
    const response = await fetch('/api/auth/link-telegram', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(telegramData),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Ошибка привязки Telegram');
    }
    
    setUser(data.user);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    return data;
  };

  // Проверка прав админа
  const checkAdmin = async () => {
    if (!token) return false;
    
    try {
      const response = await fetch('/api/auth/check-admin', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      return data.isAdmin === true;
    } catch {
      return false;
    }
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.is_admin === true;

  return (
    <AuthContext.Provider value={{ 
      user, 
      token,
      loading, 
      loginWithTelegram, 
      register,
      login,
      logout, 
      linkTelegram,
      checkAdmin,
      isAuthenticated,
      isAdmin
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth должен использоваться внутри AuthProvider');
  }
  return context;
}
