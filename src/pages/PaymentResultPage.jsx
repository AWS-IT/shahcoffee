import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';

export default function PaymentResultPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [orderData, setOrderData] = useState(null);
  const [message, setMessage] = useState('Проверяем статус платежа...');

  useEffect(() => {
    const checkPaymentStatus = async () => {
      // T-Bank: orderId передаётся в SuccessURL как query-параметр
      const orderId = searchParams.get('orderId');

      console.log('Payment result params:', { orderId });

      if (!orderId) {
        setStatus('error');
        setMessage('Не получены данные платежа. Пожалуйста, свяжитесь с поддержкой.');
        return;
      }

      // Загружаем данные заказа из БД
      try {
        const orderRes = await fetch(`/api/orders/${orderId}`);
        if (orderRes.ok) {
          const order = await orderRes.json();
          setOrderData(order);
        }
      } catch (e) {
        console.error('Error loading order details:', e);
      }

      // ВАЖНО: Проверяем реальный статус платежа на бэкенде
      try {
        setMessage('Проверяем статус платежа...');
        
        // Сначала проверим статус заказа в нашей БД (обновляется через notification от T-Bank)
        const orderStatusRes = await fetch(`/api/order/${orderId}/status`);
        
        if (orderStatusRes.ok) {
          const orderStatus = await orderStatusRes.json();
          console.log('Order status from DB:', orderStatus);
          
          // Проверяем статус - должен быть confirmed или paid
          const confirmedStatuses = ['confirmed', 'paid', 'authorized'];
          if (confirmedStatuses.includes(orderStatus.status?.toLowerCase())) {
            // Платёж подтверждён
            setStatus('success');
            setMessage('Платеж успешно обработан!');
            clearCart();

            setTimeout(() => {
              navigate(`/order?id=${orderId}`);
            }, 2000);
            return;
          }
          
          // Если статус rejected/canceled/failed
          const failedStatuses = ['rejected', 'canceled', 'failed', 'refunded'];
          if (failedStatuses.includes(orderStatus.status?.toLowerCase())) {
            setStatus('error');
            setMessage('Платёж не прошёл. Пожалуйста, попробуйте снова.');
            return;
          }
        }
        
        // Если статус в БД не подтверждён, ждём немного и проверяем снова
        // (notification от T-Bank может прийти с задержкой)
        setMessage('Ожидаем подтверждение от банка...');
        
        // Делаем несколько попыток с интервалом
        for (let attempt = 0; attempt < 5; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Ждём 2 сек
          
          const retryRes = await fetch(`/api/order/${orderId}/status`);
          if (retryRes.ok) {
            const retryStatus = await retryRes.json();
            console.log(`Attempt ${attempt + 1}: Order status:`, retryStatus);
            
            if (['confirmed', 'paid', 'authorized'].includes(retryStatus.status?.toLowerCase())) {
              setStatus('success');
              setMessage('Платеж успешно обработан!');
              clearCart();

              setTimeout(() => {
                navigate(`/order?id=${orderId}`);
              }, 2000);
              return;
            }
            
            if (['rejected', 'canceled', 'failed'].includes(retryStatus.status?.toLowerCase())) {
              setStatus('error');
              setMessage('Платёж не прошёл. Пожалуйста, попробуйте снова.');
              return;
            }
          }
        }
        
        // Если после 5 попыток статус не определён — показываем предупреждение
        setStatus('error');
        setMessage('Не удалось подтвердить платёж. Если деньги списаны — свяжитесь с поддержкой.');
        
      } catch (err) {
        console.error('Error checking payment status:', err);
        setStatus('error');
        setMessage('Ошибка проверки статуса платежа. Свяжитесь с поддержкой.');
      }
    };

    checkPaymentStatus();
  }, [searchParams, clearCart, navigate]);

  return (
    <section className="payment-result-page">
      <div className="container">
        <div className="payment-result-card">
        {status === 'processing' && (
          <>
            <div className="status-icon loading">⏳</div>
            <h1>Обработка платежа</h1>
            <p>{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="status-icon success">✓</div>
            <h1>Платеж принят!</h1>
            <p>{message}</p>
            
            {orderData && (
              <div className="order-details">
                <h2>Детали заказа:</h2>
                <p><strong>Получатель:</strong> {orderData.customerData?.name || 'Не указан'}</p>
                <p><strong>Сумма заказа:</strong> {(orderData.totalPrice || 0).toLocaleString('ru-RU')} ₽</p>
                <p><strong>Номер заказа:</strong> {orderData.orderId}</p>
                <p className="delivery-note">
                  Спасибо за заказ! Мы подготовим ваш заказ и отправим информацию о доставке на указанный email.
                </p>
              </div>
            )}

            <div className="payment-result-actions">
              <Link to="/" className="btn-primary">На главную</Link>
              <Link to="/catalog" className="btn-secondary">Продолжить покупки</Link>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="status-icon error">✕</div>
            <h1>Ошибка платежа</h1>
            <p>{message}</p>
            
            <div className="payment-result-actions">
              <Link to="/cart" className="btn-primary">Вернуться в корзину</Link>
              <Link to="/" className="btn-secondary">На главную</Link>
            </div>
          </>
        )}
      </div>
      </div>

      <style>{`
        .payment-result-page {
          min-height: 80vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          background: linear-gradient(135deg, #f6f1e9 0%, #fff 100%);
        }

        .payment-result-card {
          background: white;
          border-radius: 24px;
          padding: 60px 40px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
          text-align: center;
          max-width: 500px;
          width: 100%;
        }

        .status-icon {
          font-size: 72px;
          margin-bottom: 20px;
          display: block;
        }

        .status-icon.loading {
          animation: spin 2s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .status-icon.success {
          color: #32c7c2;
        }

        .status-icon.error {
          color: #ff4b4b;
        }

        .payment-result-card h1 {
          font-size: 32px;
          margin-bottom: 16px;
          color: #2b2620;
        }

        .payment-result-card p {
          color: #8a7b6a;
          margin-bottom: 24px;
          line-height: 1.6;
        }

        .order-details {
          background: #f6f1e9;
          border-radius: 16px;
          padding: 24px;
          margin: 30px 0;
          text-align: left;
        }

        .order-details h2 {
          color: #2b2620;
          margin-bottom: 16px;
          font-size: 18px;
        }

        .order-details p {
          margin-bottom: 12px;
          font-size: 16px;
          color: #2b2620;
        }

        .delivery-note {
          color: #008B9D !important;
          font-style: italic;
          margin-top: 16px;
        }

        .payment-result-actions {
          display: flex;
          gap: 12px;
          margin-top: 30px;
          flex-wrap: wrap;
        }

        .payment-result-actions a {
          flex: 1;
          min-width: 150px;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 12px;
          font-weight: 600;
          transition: all 0.3s ease;
          cursor: pointer;
          border: none;
          display: inline-block;
          text-align: center;
        }

        .btn-primary {
          background: #008B9D;
          color: white;
        }

        .btn-primary:hover {
          background: #0094A0;
        }

        .btn-secondary {
          background: #e3fbfa;
          color: #008B9D;
        }

        .btn-secondary:hover {
          background: #d7f7f5;
        }
      `}</style>
    </section>
  );
}

