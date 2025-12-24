import React, { useState } from 'react';
import { useCart } from '../context/CartContext.jsx';

export default function PaymentTestPage() {
  const { cart, addToCart, totalPrice } = useCart();
  const [testOrderId, setTestOrderId] = useState('test-' + Date.now());

  // Добавляем тестовый товар в корзину если её нет
  React.useEffect(() => {
    if (cart.length === 0) {
      addToCart({
        id: 'test-product-1',
        name: 'Тестовый кофе',
        priceRub: 500,
        image: null,
        code: 'TEST-001'
      }, 2);
    }
  }, []);

  const handleInitPayment = async () => {
    try {
      const response = await fetch('http://localhost:3001/robokassa/init-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: testOrderId,
          amount: totalPrice.toFixed(2),
          description: 'Тестовый заказ',
          customerEmail: 'test@example.com'
        })
      });

      const data = await response.json();
      console.log('Payment init response:', data);
      alert('Инициирование платежа успешно!\nURL: ' + data.redirectUrl);
      // window.location.href = data.redirectUrl; // Раскомментируйте для реального редиректа
    } catch (error) {
      console.error('Error:', error);
      alert('Ошибка: ' + error.message);
    }
  };

  const handleSimulatePaymentResult = async () => {
    try {
      // Тестирование результата платежа
      const response = await fetch('http://localhost:3001/robokassa/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          OrderId: testOrderId,
          Sum: totalPrice.toFixed(2),
          SignatureValue: 'test-signature' // В боевом режиме будет реальная подпись
        })
      });

      const data = await response.json();
      console.log('Result response:', data);
      alert('Результат платежа отправлен на сервер');
    } catch (error) {
      console.error('Error:', error);
      alert('Ошибка: ' + error.message);
    }
  };

  return (
    <section className="payment-test-page">
      <div className="container">
        <h1>🧪 Страница тестирования платежей</h1>
        
        <div className="test-info">
          <h2>Информация о тесте</h2>
          <p><strong>Order ID:</strong> <code>{testOrderId}</code></p>
          <p><strong>Сумма:</strong> {totalPrice.toLocaleString('ru-RU')} ₽</p>
          <p><strong>Товаров в корзине:</strong> {cart.length}</p>
        </div>

        <div className="test-cart">
          <h2>Содержимое корзины</h2>
          {cart.length > 0 ? (
            <ul>
              {cart.map(item => (
                <li key={item.id}>
                  {item.name} × {item.quantity} = {(item.priceRub * item.quantity).toLocaleString('ru-RU')} ₽
                </li>
              ))}
            </ul>
          ) : (
            <p>Корзина пуста</p>
          )}
        </div>

        <div className="test-actions">
          <h2>Тесты</h2>
          <button onClick={handleInitPayment} className="test-btn test-btn-primary">
            1️⃣ Инициировать платеж (init-payment)
          </button>
          <p className="test-description">
            Отправляет запрос на сервер для получения URL редиректа на Robokassa
          </p>

          <button onClick={handleSimulatePaymentResult} className="test-btn test-btn-secondary">
            2️⃣ Имитировать результат платежа (result)
          </button>
          <p className="test-description">
            Имитирует callback от Robokassa (обычно сервер это обрабатывает, не браузер)
          </p>

          <a href="/checkout" className="test-btn test-btn-checkout">
            3️⃣ Перейти на страницу оформления (/checkout)
          </a>
          <p className="test-description">
            Переход на реальную форму оформления заказа
          </p>

          <a href="/cart" className="test-btn test-btn-cart">
            4️⃣ Перейти в корзину (/cart)
          </a>
          <p className="test-description">
            Просмотр содержимого корзины
          </p>
        </div>

        <div className="test-logs">
          <h2>📋 Инструкция по тестированию</h2>
          <ol>
            <li>Нажмите кнопку "Инициировать платеж" — вы получите URL редиректа</li>
            <li>В консоли браузера (F12 → Console) будут видны запросы и ответы</li>
            <li>Откройте сеть (F12 → Network) для просмотра всех HTTP запросов</li>
            <li>Проверьте сервер (Terminal) — там должны быть логи об обработке платежей</li>
            <li>Для полного тестирования отредактируйте форму в /checkout вручную</li>
          </ol>
        </div>

        <style>{`
          .payment-test-page {
            min-height: 100vh;
            padding: 40px 20px;
            background: linear-gradient(135deg, #f6f1e9 0%, #fff 100%);
          }

          .payment-test-page h1 {
            text-align: center;
            font-size: 36px;
            color: #2b2620;
            margin-bottom: 40px;
          }

          .test-info,
          .test-cart,
          .test-actions,
          .test-logs {
            background: white;
            border-radius: 16px;
            padding: 30px;
            margin-bottom: 30px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
          }

          .test-info h2,
          .test-cart h2,
          .test-actions h2,
          .test-logs h2 {
            color: #008B9D;
            margin-bottom: 20px;
            font-size: 20px;
          }

          .test-info p,
          .test-cart p {
            margin: 12px 0;
            color: #2b2620;
            font-size: 16px;
          }

          code {
            background: #f0f0f0;
            padding: 4px 8px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            color: #ff4b4b;
          }

          .test-cart ul {
            list-style: none;
            padding: 0;
          }

          .test-cart li {
            padding: 12px;
            background: #f6f1e9;
            border-radius: 8px;
            margin-bottom: 8px;
            color: #2b2620;
            border-left: 4px solid #32c7c2;
          }

          .test-btn {
            display: block;
            width: 100%;
            padding: 14px 20px;
            margin: 20px 0 8px 0;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            text-decoration: none;
            text-align: center;
          }

          .test-btn-primary {
            background: #008B9D;
            color: white;
          }

          .test-btn-primary:hover {
            background: #0094A0;
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(0, 139, 157, 0.3);
          }

          .test-btn-secondary {
            background: #32c7c2;
            color: white;
          }

          .test-btn-secondary:hover {
            background: #22b0ab;
            transform: translateY(-2px);
          }

          .test-btn-checkout {
            background: #f6a500;
            color: white;
          }

          .test-btn-checkout:hover {
            background: #e89500;
            transform: translateY(-2px);
          }

          .test-btn-cart {
            background: #e3fbfa;
            color: #008B9D;
            border: 2px solid #32c7c2;
          }

          .test-btn-cart:hover {
            background: #d7f7f5;
          }

          .test-description {
            color: #8a7b6a;
            font-size: 14px;
            margin-top: -6px;
            margin-bottom: 0;
          }

          .test-logs ol {
            padding-left: 24px;
            color: #2b2620;
          }

          .test-logs li {
            margin-bottom: 12px;
            line-height: 1.6;
          }

          @media (max-width: 600px) {
            .payment-test-page h1 {
              font-size: 24px;
            }

            .test-info,
            .test-cart,
            .test-actions,
            .test-logs {
              padding: 20px;
            }
          }
        `}</style>
      </div>
    </section>
  );
}
