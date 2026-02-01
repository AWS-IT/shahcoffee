import React, { useState } from 'react';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { Link, useNavigate } from 'react-router-dom';
import AddressSuggest from '../components/AddressSuggest.jsx';

export default function CheckoutPage() {
  const { cart, totalPrice, clearCart } = useCart();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: user?.first_name || '',
    phone: '',
    email: '',
    address: '',
  });
  const [coordinates, setCoordinates] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (cart.length === 0) {
    return (
      <section className="checkout-page">
        <div className="container">
          <h1>Корзина пуста</h1>
          <p>Добавьте товары для оформления заказа</p>
          <Link to="/catalog" className="btn-primary">Перейти в каталог</Link>
        </div>
      </section>
    );
  }

  // Проверка авторизации через Telegram
  if (!isAuthenticated) {
    return (
      <section className="checkout-page">
        <div className="container">
          <div className="auth-required">
            <h1>🔐 Требуется авторизация</h1>
            <p>Для оформления заказа необходимо войти через Telegram</p>
            <p className="auth-hint">Нажмите на кнопку «Войти» в шапке сайта</p>
            <Link to="/" className="btn-primary">На главную</Link>
          </div>
        </div>
      </section>
    );
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleAddressChange = (address) => {
    setFormData({
      ...formData,
      address,
    });
  };

  const handleAddressSelect = (suggestion) => {
    setFormData({
      ...formData,
      address: suggestion.address,
    });
    setCoordinates(suggestion.coordinates);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Проверяем что адрес выбран из списка (есть координаты)
    if (!coordinates) {
      setError('Пожалуйста, выберите адрес из списка подсказок');
      return;
    }

    setLoading(true);

    try {
      // Генерируем уникальный ID заказа
      const orderId = `order-${Date.now()}`;
      const description = `Заказ кофе на имя ${formData.name}`;

      // Сохраняем данные заказа в localStorage перед редиректом
      localStorage.setItem('pendingOrder', JSON.stringify({
        orderId,
        customerData: formData,
        coordinates,
        items: cart,
        totalPrice,
        createdAt: new Date().toISOString(),
      }));

      // Инициируем платеж через T-Bank
      const response = await fetch('/api/tbank/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          amount: totalPrice,
          description,
          data: {
            customerEmail: formData.email,
            customerPhone: formData.phone,
            connection_type: 'Widget'
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Ошибка при инициировании платежа');
      }

      const paymentData = await response.json();
      console.log('T-Bank payment init response:', paymentData);

      if (paymentData.PaymentURL) {
        // Перенаправляем на страницу оплаты T-Bank
        window.location.href = paymentData.PaymentURL;
      } else {
        throw new Error('Не получен URL для оплаты');
      }
    } catch (err) {
      console.error('Ошибка оформления заказа:', err);
      setError(err.message || 'Ошибка при оформлении заказа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="checkout-page">
      <div className="container">
        <h1>Оформление заказа</h1>

        <div className="checkout-layout">
          {/* Форма заказа */}
          <div className="checkout-form">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Ваше имя *</label>
                <input
                  id="name"
                  type="text"
                  name="name"
                  placeholder="Иван Петров"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">Телефон *</label>
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  placeholder="+7 (999) 123-45-67"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email *</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  placeholder="ivan@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="address">Адрес доставки *</label>
                <AddressSuggest
                  value={formData.address}
                  onChange={handleAddressChange}
                  onSelect={handleAddressSelect}
                  placeholder="Начните вводить адрес..."
                />
                {coordinates && (
                  <p className="address-confirmed">
                    ✓ Адрес подтверждён
                  </p>
                )}
              </div>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary btn-lg"
              >
                {loading ? 'Обработка...' : 'Перейти к оплате'}
              </button>

              <button
                type="button"
                onClick={() => navigate('/cart')}
                className="btn-secondary"
              >
                Вернуться в корзину
              </button>
            </form>
          </div>

          {/* Сводка заказа */}
          <div className="checkout-summary">
            <h2>Сводка заказа</h2>
            <div className="order-items">
              {cart.map(item => (
                <div key={item.id} className="order-item">
                  <div className="order-item__info">
                    <p className="order-item__name">{item.name}</p>
                    <p className="order-item__quantity">Кол-во: {item.quantity} уп.</p>
                  </div>
                  <p className="order-item__price">
                    {(item.priceRub * item.quantity).toLocaleString('ru-RU')} ₽
                  </p>
                </div>
              ))}
            </div>
            <div className="order-total">
              <h3>Итого к оплате:</h3>
              <p className="total-price">
                {totalPrice.toLocaleString('ru-RU')} ₽
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
