import React, { useState } from 'react';
import { useCart } from '../context/CartContext.jsx';
import { Link, useNavigate } from 'react-router-dom';

export default function CheckoutPage() {
  const { cart, totalPrice, clearCart } = useCart();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  });
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

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Генерируем уникальный ID заказа (например: 20250123_1234567890)
      const orderId = `${Date.now()}_${Math.random().toString().slice(2, 10)}`;
      const description = `Заказ кофе на имя ${formData.name}`;

      // Отправляем запрос на сервер для инициирования платежа
      const response = await fetch('http://localhost:3001/robokassa/init-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          amount: totalPrice.toFixed(2),
          description,
          customerEmail: formData.email,
        }),
      });

      if (!response.ok) {
        throw new Error('Ошибка при инициировании платежа');
      }

      const paymentData = await response.json();

      // Сохраняем данные заказа в localStorage перед редиректом
      localStorage.setItem('pendingOrder', JSON.stringify({
        orderId,
        customerData: formData,
        cartItems: cart,
        totalPrice,
      }));

      // Перенаправляем пользователя на Robokassa
      window.location.href = paymentData.redirectUrl;
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
                <label htmlFor="address">Адрес доставки</label>
                <textarea
                  id="address"
                  name="address"
                  placeholder="Москва, ул. Пушкина, д. 10"
                  value={formData.address}
                  onChange={handleChange}
                  rows="3"
                  className="form-textarea"
                />
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
