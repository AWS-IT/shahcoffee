import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TelegramLoginButton from '../components/TelegramLoginButton';
import '../styles/login.css';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Если уже авторизован, редирект в профиль
  if (isAuthenticated) {
    navigate('/profile');
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        if (!firstName.trim()) {
          throw new Error('Введите имя');
        }
        await register(email, password, firstName, phone);
      }
      navigate('/profile');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="login-page">
      <div className="container">
        <div className="login-card">
          <h1>{isLogin ? 'Вход' : 'Регистрация'}</h1>
          
          <div className="login-tabs">
            <button 
              className={`login-tab ${isLogin ? 'active' : ''}`}
              onClick={() => { setIsLogin(true); setError(''); }}
            >
              Вход
            </button>
            <button 
              className={`login-tab ${!isLogin ? 'active' : ''}`}
              onClick={() => { setIsLogin(false); setError(''); }}
            >
              Регистрация
            </button>
          </div>

          {error && <div className="login-error">{error}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            {!isLogin && (
              <div className="form-group">
                <label>Имя *</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ваше имя"
                  required={!isLogin}
                />
              </div>
            )}

            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@mail.ru"
                required
              />
            </div>

            <div className="form-group">
              <label>Пароль *</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isLogin ? 'Введите пароль' : 'Минимум 6 символов'}
                required
                minLength={6}
              />
            </div>

            {!isLogin && (
              <div className="form-group">
                <label>Телефон</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+7 (999) 123-45-67"
                />
              </div>
            )}

            <button type="submit" className="btn-primary login-btn" disabled={loading}>
              {loading ? 'Загрузка...' : (isLogin ? 'Войти' : 'Зарегистрироваться')}
            </button>
          </form>

          <div className="login-divider">
            <span>или</span>
          </div>

          <div className="login-telegram">
            <TelegramLoginButton />
          </div>

          <Link to="/" className="login-back">← На главную</Link>
        </div>
      </div>
    </section>
  );
}
