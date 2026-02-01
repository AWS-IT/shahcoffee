import React, { useState, useEffect, useRef } from 'react';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { Link, useNavigate } from 'react-router-dom';
import AddressSuggest from '../components/AddressSuggest.jsx';

// Ключ терминала T-Bank
const TBANK_TERMINAL_KEY = '1769767428904';

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
  const [formValid, setFormValid] = useState(false);
  const [showPaymentButtons, setShowPaymentButtons] = useState(false);
  const [orderData, setOrderData] = useState(null);
  const paymentContainerRef = useRef(null);
  const integrationLoadedRef = useRef(false);

  // Проверка валидности формы
  useEffect(() => {
    const isValid = formData.name && formData.phone && formData.email && coordinates;
    setFormValid(isValid);
  }, [formData, coordinates]);

  // Загрузка и инициализация T-Bank виджета
  useEffect(() => {
    if (!showPaymentButtons || !paymentContainerRef.current || integrationLoadedRef.current) {
      return;
    }

    const loadTBankWidget = async () => {
      // Загружаем скрипт integration.js
      if (!window.PaymentIntegration) {
        const script = document.createElement('script');
        script.src = 'https://integrationjs.tbank.ru/integration.js';
        script.async = true;
        
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
      }

      // Callback для получения PaymentURL
      const paymentStartCallback = async () => {
        console.log('paymentStartCallback called, orderData:', orderData);
        
        if (!orderData) {
          throw new Error('Данные заказа не готовы');
        }

        const response = await fetch('/api/tbank/initiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: orderData.orderId,
            amount: totalPrice,
            description: `Заказ кофе на имя ${formData.name}`,
            data: {
              customerEmail: formData.email,
              customerPhone: formData.phone,
            }
          }),
        });

        if (!response.ok) {
          throw new Error('Ошибка при инициировании платежа');
        }

        const paymentData = await response.json();
        console.log('T-Bank payment init response:', paymentData);

        if (!paymentData.PaymentURL) {
          throw new Error('Не получен URL для оплаты');
        }

        return paymentData.PaymentURL;
      };

      // Инициализируем виджет с callback в конфигурации
      const initConfig = {
        terminalKey: TBANK_TERMINAL_KEY,
        product: 'eacq',
        features: {
          payment: {
            container: paymentContainerRef.current,
            paymentStartCallback: paymentStartCallback,
          }
        }
      };

      try {
        const integration = await window.PaymentIntegration.init(initConfig);
        console.log('T-Bank integration initialized with payment buttons');
        
        integrationLoadedRef.current = true;
        setLoading(false);
        
        console.log('T-Bank payment buttons ready');
      } catch (err) {
        console.error('T-Bank widget init error:', err);
        setError('Ошибка загрузки платёжных кнопок: ' + err.message);
        setLoading(false);
      }
    };

    loadTBankWidget();
  }, [showPaymentButtons, orderData, totalPrice, formData]);

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

      // Сохраняем данные заказа в localStorage и state
      const orderInfo = {
        orderId,
        customerData: formData,
        coordinates,
        items: cart,
        totalPrice,
        createdAt: new Date().toISOString(),
      };
      
      localStorage.setItem('pendingOrder', JSON.stringify(orderInfo));
      setOrderData(orderInfo);
      
      // Показываем кнопки оплаты
      setShowPaymentButtons(true);
      integrationLoadedRef.current = false; // Сбрасываем для перезагрузки виджета
      setLoading(false);
      
    } catch (err) {
      console.error('Ошибка оформления заказа:', err);
      setError(err.message || 'Ошибка при оформлении заказа');
      setLoading(false);
    }
  };

  // Альтернативная оплата — редирект на стандартную форму T-Bank
  const handleFallbackPayment = async () => {
    if (!orderData) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/tbank/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderData.orderId,
          amount: totalPrice,
          description: `Заказ кофе на имя ${formData.name}`,
          data: {
            customerEmail: formData.email,
            customerPhone: formData.phone,
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Ошибка при инициировании платежа');
      }

      const paymentData = await response.json();
      
      if (paymentData.PaymentURL) {
        window.location.href = paymentData.PaymentURL;
      } else {
        throw new Error('Не получен URL для оплаты');
      }
    } catch (err) {
      console.error('Ошибка оплаты:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <section className="checkout-page">
      <div className="container">
        <h1>Оформление заказа</h1>

        <div className="checkout-layout">
          {/* Форма заказа или кнопки оплаты */}
          <div className="checkout-form">
            {!showPaymentButtons ? (
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
                  disabled={loading || !formValid}
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
            ) : (
              <div className="payment-section">
                <h2>💳 Выберите способ оплаты</h2>
                <p className="payment-info">
                  Заказ #{orderData?.orderId}<br />
                  Сумма: <strong>{totalPrice.toLocaleString('ru-RU')} ₽</strong>
                </p>

                {error && (
                  <div className="error-message">
                    {error}
                  </div>
                )}

                {loading && (
                  <div className="loading-spinner">
                    <p>Загрузка способов оплаты...</p>
                  </div>
                )}

                {/* Контейнер для кнопок T-Bank (СБП, T-Pay) */}
                <div 
                  ref={paymentContainerRef} 
                  id="tbank-payment-container"
                  className="tbank-payment-buttons"
                  style={{ minHeight: '60px', marginBottom: '20px' }}
                />

                {/* Альтернативная кнопка — оплата картой на странице T-Bank */}
                <div className="payment-alternative">
                  <p className="payment-divider">или</p>
                  <button
                    type="button"
                    onClick={handleFallbackPayment}
                    disabled={loading}
                    className="btn-secondary btn-lg"
                  >
                    💳 Оплатить картой
                  </button>
                  <p className="payment-hint">
                    Перейти на защищённую страницу T-Bank
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentButtons(false);
                    setOrderData(null);
                    integrationLoadedRef.current = false;
                  }}
                  className="btn-link"
                  style={{ marginTop: '20px' }}
                >
                  ← Изменить данные заказа
                </button>
              </div>
            )}
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
