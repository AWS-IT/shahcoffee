import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TelegramLoginButton from '../components/TelegramLoginButton';
import '../styles/profile.css';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, checkAdmin, logout, loading: authLoading } = useAuth();
  const [showAdminLink, setShowAdminLink] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Загружаем заказы пользователя из БД
    loadOrders();
  }, [user?.id]);

  // Проверяем права админа
  useEffect(() => {
    if (isAdmin) {
      setShowAdminLink(true);
    } else if (isAuthenticated) {
      checkAdmin().then(result => setShowAdminLink(result));
    }
  }, [isAuthenticated, isAdmin]);

  const loadOrders = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    
    try {
      // Загружаем заказы ТОЛЬКО из БД
      const response = await fetch(`/api/users/${user.id}/orders`);
      if (response.ok) {
        const dbOrders = await response.json();
        console.log('📦 Загружено заказов из БД:', dbOrders.length, 'для user.id:', user.id);
        setOrders(dbOrders);
      } else {
        console.error('Ошибка загрузки заказов:', response.status);
        setOrders([]);
      }
    } catch (e) {
      console.error('Ошибка загрузки заказов:', e);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getStatusText = (status) => {
    const statuses = {
      pending: 'Ожидает оплаты',
      authorized: 'Авторизован',
      paid: 'Оплачено',
      confirmed: 'Оплачено',
      processing: 'Готовится',
      shipped: 'В пути',
      delivered: 'Доставлено',
      canceled: 'Отменено',
      cancelled: 'Отменено',
      rejected: 'Отклонено',
      refunded: 'Возврат',
      failed: 'Ошибка оплаты',
    };
    const key = status?.toLowerCase();
    return statuses[key] || status || 'Неизвестно';
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#ffa500',
      authorized: '#008B9D',
      paid: '#008B9D',
      confirmed: '#008B9D',
      processing: '#9b59b6',
      shipped: '#3498db',
      delivered: '#27ae60',
      canceled: '#e74c3c',
      cancelled: '#e74c3c',
      rejected: '#e74c3c',
      refunded: '#9b59b6',
      failed: '#e74c3c',
    };
    const key = status?.toLowerCase();
    return colors[key] || '#888';
  };

  if (loading || authLoading) {
    return (
      <section className="profile-page">
        <div className="container">
          <div className="loading">Загрузка...</div>
        </div>
      </section>
    );
  }

  // Если не авторизован - показываем экран входа
  if (!isAuthenticated) {
    return (
      <section className="profile-page">
        <div className="container">
          <div className="auth-prompt">
            <div className="auth-icon">🔐</div>
            <h1>Личный кабинет</h1>
            <p>Войдите через Telegram, чтобы видеть историю заказов и управлять профилем</p>
            <div className="auth-button-wrapper">
              <TelegramLoginButton />
            </div>
            <Link to="/catalog" className="btn-secondary">
              Перейти в каталог
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="profile-page">
      <div className="container">
        <div className="profile-header">
          <div className="profile-info">
            <div className="profile-avatar">
              {user?.photo_url ? (
                <img src={user.photo_url} alt={user.first_name} />
              ) : (
                <span className="avatar-placeholder">
                  {user?.first_name?.[0] || '👤'}
                </span>
              )}
            </div>
            <div className="profile-details">
              <h1>{user?.first_name} {user?.last_name || ''}</h1>
              {user?.username && <p className="username">@{user.username}</p>}
              <p className="member-since">Участник с {new Date().toLocaleDateString('ru-RU')}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="logout-btn">
            Выйти
          </button>
        </div>

        {showAdminLink && (
          <div className="profile-admin-link">
            <Link to="/admin" className="btn-admin">
              ⚙️ Админ-панель
            </Link>
          </div>
        )}

        <div className="profile-content">
          <div className="orders-section">
            <h2>📦 Мои заказы</h2>
            
            {orders.length === 0 ? (
              <div className="no-orders">
                <p>У вас пока нет заказов</p>
                <Link to="/catalog" className="btn-primary">
                  Перейти в каталог
                </Link>
              </div>
            ) : (
              <div className="orders-list">
                {orders.map((order, index) => (
                  <div key={order.orderId || index} className="order-card">
                    <div className="order-header">
                      <div className="order-id">
                        <span>Заказ</span>
                        <strong>#{order.orderId?.slice(-8) || index + 1}</strong>
                      </div>
                      <span 
                        className="order-status"
                        style={{ backgroundColor: getStatusColor(order.status) }}
                      >
                        {getStatusText(order.status)}
                      </span>
                    </div>

                    <div className="order-content">
                      <div className="order-body">
                        {/* Адрес доставки */}
                        {order.customerData?.address && (
                          <div className="order-address">
                            📍 {order.customerData.address}
                          </div>
                        )}

                        {/* Состав заказа */}
                        <div className="order-items-preview">
                          {(order.items || []).slice(0, 3).map((item, i) => (
                            <span key={i} className="order-item-name">
                              {item.name} × {item.quantity}
                            </span>
                          ))}
                          {(order.items || []).length > 3 && (
                            <span className="more-items">
                              +{(order.items || []).length - 3} ещё
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="order-meta">
                        <span className="order-price">
                          {Number(order.totalPrice || 0).toLocaleString('ru-RU')} ₽
                        </span>
                        {order.createdAt && (
                          <span className="order-date">
                            {new Date(order.createdAt).toLocaleDateString('ru-RU')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="order-footer">
                      <Link 
                        to={`/order?id=${order.orderId}`} 
                        className="btn-secondary"
                      >
                        Подробнее
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
