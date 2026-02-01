import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TelegramLoginButton from '../components/TelegramLoginButton';
import '../styles/profile.css';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Загружаем заказы пользователя из БД
    loadOrders();
  }, [user?.id]);

  const loadOrders = async () => {
    try {
      // Загружаем заказы пользователя из БД
      if (user?.id) {
        const response = await fetch(`/api/orders/user/${user.id}`);
        if (response.ok) {
          const dbOrders = await response.json();
          setOrders(dbOrders);
          setLoading(false);
          return;
        }
      }
      
      // Fallback: если нет user.id или API недоступен, берём из localStorage
      const savedOrders = localStorage.getItem('userOrders');
      if (savedOrders) {
        const localOrders = JSON.parse(savedOrders);
        
        // Проверяем актуальный статус каждого заказа из БД
        const updatedOrders = await Promise.all(
          localOrders.map(async (order) => {
            if (order.orderId) {
              try {
                const res = await fetch(`/api/order/${order.orderId}/status`);
                if (res.ok) {
                  const data = await res.json();
                  return { ...order, status: data.status };
                }
              } catch (e) {
                console.error('Ошибка проверки статуса:', e);
              }
            }
            return order;
          })
        );
        
        setOrders(updatedOrders);
        localStorage.setItem('userOrders', JSON.stringify(updatedOrders));
      }
    } catch (e) {
      console.error('Ошибка загрузки заказов:', e);
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
      paid: 'Оплачено',
      confirmed: 'Оплачено',
      CONFIRMED: 'Оплачено',
      processing: 'Готовится',
      shipped: 'В пути',
      delivered: 'Доставлено',
      cancelled: 'Отменено',
      REJECTED: 'Отклонено',
      REFUNDED: 'Возврат',
    };
    return statuses[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#ffa500',
      paid: '#008B9D',
      confirmed: '#008B9D',
      CONFIRMED: '#008B9D',
      processing: '#9b59b6',
      shipped: '#3498db',
      delivered: '#27ae60',
      cancelled: '#e74c3c',
      REJECTED: '#e74c3c',
      REFUNDED: '#9b59b6',
    };
    return colors[status] || '#888';
  };

  if (loading) {
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

                    <div className="order-body">
                      <div className="order-items-preview">
                        {(order.items || order.cartItems)?.slice(0, 3).map((item, i) => (
                          <span key={i} className="order-item-name">
                            {item.name} × {item.quantity}
                          </span>
                        ))}
                        {(order.items || order.cartItems)?.length > 3 && (
                          <span className="more-items">
                            +{(order.items || order.cartItems).length - 3} ещё
                          </span>
                        )}
                      </div>

                      <div className="order-meta">
                        <span className="order-price">
                          {order.totalPrice?.toLocaleString('ru-RU')} ₽
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
                        onClick={() => localStorage.setItem('pendingOrder', JSON.stringify(order))}
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
