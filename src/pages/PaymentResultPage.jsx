import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

export default function PaymentResultPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [orderData, setOrderData] = useState(null);
  const [message, setMessage] = useState('Обработка платежа...');

  useEffect(() => {
    // Получаем параметры из URL
    const orderId = searchParams.get('OrderId');
    const invoiceId = searchParams.get('InvId');
    const signatureValue = searchParams.get('SignatureValue');
    const isFail = searchParams.get('fail');

    // Получаем сохраненные данные заказа из localStorage
    const pendingOrder = localStorage.getItem('pendingOrder');
    if (pendingOrder) {
      setOrderData(JSON.parse(pendingOrder));
    }

    // Если это ошибка платежа
    if (isFail === '1') {
      setStatus('error');
      setMessage('Платеж не прошел. Пожалуйста, попробуйте еще раз.');
      return;
    }

    if (orderId && signatureValue) {
      // Отправляем запрос на сервер для подтверждения платежа
      confirmPayment(orderId, signatureValue, invoiceId);
    } else {
      setStatus('error');
      setMessage('Не получены данные платежа. Пожалуйста, свяжитесь с поддержкой.');
    }
  }, [searchParams]);

  const confirmPayment = async (orderId, signatureValue, invoiceId) => {
    try {
      const response = await fetch('http://localhost:3001/robokassa/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          OrderId: orderId,
          InvId: invoiceId,
          SignatureValue: signatureValue,
        }),
      });

      if (!response.ok) {
        throw new Error('Ошибка при обработке платежа');
      }

      // Платеж успешно обработан
      setStatus('success');
      setMessage('Платеж успешно обработан! Спасибо за ваш заказ.');
      
      // Очищаем localStorage
      localStorage.removeItem('pendingOrder');
    } catch (error) {
      console.error('Ошибка подтверждения платежа:', error);
      setStatus('error');
      setMessage('Ошибка при обработке платежа. Пожалуйста, свяжитесь с поддержкой.');
    }
  };

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
                <p><strong>Получатель:</strong> {orderData.customerData.name}</p>
                <p><strong>Сумма заказа:</strong> {orderData.totalPrice.toLocaleString('ru-RU')} ₽</p>
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

