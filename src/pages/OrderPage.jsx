import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import YandexMap from '../components/YandexMap';

export default function OrderPage() {
  const [searchParams] = useSearchParams();
  const [orderData, setOrderData] = useState(null);
  const [orderStatus, setOrderStatus] = useState('pending'); // Реальный статус из БД
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrder = async () => {
      const orderId = searchParams.get('id');
      if (!orderId) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/orders/${orderId}`);
        if (response.ok) {
          const order = await response.json();
          setOrderData(order);
          setOrderStatus(order.status || 'pending');
        } else {
          setOrderData(null);
        }
      } catch (e) {
        console.error('Ошибка загрузки заказа:', e);
        setOrderData(null);
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [searchParams]);

  // Helper функции для отображения статуса
  const getStatusText = (status) => {
    const statusMap = {
      pending: 'Ожидает оплаты',
      authorized: 'Авторизован',
      confirmed: 'Оплачено',
      paid: 'Оплачено',
      processing: 'Готовится',
      shipped: 'В пути',
      delivered: 'Доставлено',
      rejected: 'Отклонён',
      canceled: 'Отменён',
      cancelled: 'Отменён',
      refunded: 'Возврат',
      failed: 'Ошибка оплаты'
    };
    return statusMap[status?.toLowerCase()] || status || 'Неизвестен';
  };

  const getStatusIcon = (status) => {
    const iconMap = {
      pending: '⏳',
      authorized: '🔒',
      confirmed: '✅',
      paid: '✅',
      processing: '🛠️',
      shipped: '🚚',
      delivered: '📦',
      rejected: '❌',
      canceled: '🚫',
      cancelled: '🚫',
      refunded: '↩️',
      failed: '❌'
    };
    return iconMap[status?.toLowerCase()] || '❓';
  };

  const getStatusClass = (status) => {
    const successStatuses = ['confirmed', 'paid', 'authorized'];
    const errorStatuses = ['rejected', 'canceled', 'cancelled', 'failed'];
    
    if (successStatuses.includes(status?.toLowerCase())) return 'status-success';
    if (errorStatuses.includes(status?.toLowerCase())) return 'status-error';
    return 'status-pending';
  };

  if (loading) {
    return (
      <section className="order-page">
        <div className="container">
          <div className="loading-spinner">Загрузка...</div>
        </div>
      </section>
    );
  }

  if (!orderData) {
    return (
      <section className="order-page">
        <div className="container">
          <div className="error-card">
            <h1>😕 Заказ не найден</h1>
            <p>Вернитесь в каталог и повторите попытку</p>
            <Link to="/catalog" className="btn-primary">В каталог</Link>
          </div>
        </div>
      </section>
    );
  }

  const coordinates = orderData.coordinates || { lat: 55.7558, lon: 37.6173 };

  return (
    <section className="order-page">
      <div className="container">
        <div className="order-header">
          <h1>📦 Ваш заказ</h1>
          <p className="order-subtitle">Отслеживание доставки</p>
        </div>

        <div className="order-content">
          {/* Левая колонка - информация заказа */}
          <div className="order-info">
            <div className="info-card">
              <h2>Детали заказа</h2>
              
              <div className="info-section">
                <h3>👤 Получатель</h3>
                <p><strong>{orderData.customerData?.name || 'Не указан'}</strong></p>
                <p>📞 {orderData.customerData?.phone || 'Не указан'}</p>
                <p>📧 {orderData.customerData?.email || 'Не указан'}</p>
              </div>

              <div className="info-section">
                <h3>📍 Адрес доставки</h3>
                <p>{orderData.customerData?.address || 'Адрес не указан'}</p>
              </div>

              <div className="info-section">
                <h3>💳 Сумма заказа</h3>
                <p className="price">{orderData.totalPrice?.toLocaleString('ru-RU') || '0'} ₽</p>
              </div>

              <div className="info-section">
                <h3>🔢 Номер заказа</h3>
                <p className="order-id">{orderData.orderId}</p>
              </div>

              <div className="info-section">
                <h3>📋 Состав заказа</h3>
                <div className="order-items">
                  {orderData.items?.length ? (
                    orderData.items.map((item, idx) => (
                      <div key={idx} className="order-item">
                        <span>{item.name}</span>
                        <span>
                          {item.quantity} x {(item.priceRub ?? item.price ?? 0).toLocaleString('ru-RU')} ₽
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="order-item">
                      <span>Состав заказа не найден</span>
                      <span>—</span>
                    </div>
                  )}
                </div>
              </div>

              <div className={`order-status ${getStatusClass(orderStatus)}`}>
                <span className="status-label">{getStatusIcon(orderStatus)} Статус</span>
                <span className="status-badge">{getStatusText(orderStatus)}</span>
              </div>
            </div>

            <Link to="/" className="btn-secondary">← На главную</Link>
          </div>

          {/* Правая колонка - карта */}
          <div className="order-map-container">
            <div className="map-card">
              <h2>🗺️ Место доставки</h2>
              <YandexMap 
                address={orderData.customerData?.address}
                orderData={orderData}
                lat={coordinates.lat}
                lon={coordinates.lon}
              />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .order-page {
          min-height: 100vh;
          padding: 40px 20px;
          background: linear-gradient(135deg, #f6f1e9 0%, #fff 100%);
        }

        .order-header {
          text-align: center;
          margin-bottom: 40px;
        }

        .order-header h1 {
          font-size: 40px;
          color: #2b2620;
          margin-bottom: 10px;
        }

        .order-subtitle {
          font-size: 16px;
          color: #8a7b6a;
        }

        .order-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          margin-bottom: 40px;
        }

        @media (max-width: 1024px) {
          .order-content {
            grid-template-columns: 1fr;
          }
        }

        .order-info {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .info-card {
          background: white;
          border-radius: 24px;
          padding: 30px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
        }

        .info-card h2 {
          font-size: 24px;
          color: #2b2620;
          margin-bottom: 25px;
          border-bottom: 2px solid #008B9D;
          padding-bottom: 15px;
        }

        .info-section {
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid #e3fbfa;
        }

        .info-section:last-of-type {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }

        .info-section h3 {
          font-size: 14px;
          font-weight: 700;
          color: #008B9D;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .info-section p {
          color: #2b2620;
          font-size: 16px;
          margin: 5px 0;
          line-height: 1.6;
        }

        .price {
          font-size: 32px;
          font-weight: 700;
          color: #008B9D;
        }

        .order-id {
          font-family: 'Courier New', monospace;
          background: #f6f1e9;
          padding: 8px 12px;
          border-radius: 6px;
          font-weight: 600;
        }

        .order-items {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .order-item {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #f0f0f0;
          font-size: 14px;
        }

        .order-item:last-child {
          border-bottom: none;
        }

        .order-status {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #008B9D;
          padding: 12px 16px;
          border-radius: 12px;
        }

        .order-status.status-success {
          background: #008B9D;
        }

        .order-status.status-error {
          background: #dc3545;
        }

        .order-status.status-pending {
          background: #ffc107;
        }

        .order-status.status-pending .status-label {
          color: #333;
        }

        .order-status.status-pending .status-badge {
          color: #856404;
        }

        .order-status.status-error .status-badge {
          color: #dc3545;
        }

        .status-label {
          color: white;
          font-size: 14px;
          font-weight: 600;
        }

        .status-badge {
          display: inline-block;
          background: white;
          color: #008B9D;
          padding: 6px 14px;
          border-radius: 20px;
          font-weight: 600;
          font-size: 13px;
        }

        .order-map-container {
          display: flex;
          flex-direction: column;
        }

        .map-card {
          background: white;
          border-radius: 24px;
          padding: 30px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .map-card h2 {
          font-size: 24px;
          color: #2b2620;
          margin-bottom: 20px;
          border-bottom: 2px solid #008B9D;
          padding-bottom: 15px;
        }

        .btn-primary, .btn-secondary {
          padding: 14px 28px;
          border: none;
          border-radius: 12px;
          font-weight: 600;
          font-size: 16px;
          cursor: pointer;
          text-decoration: none;
          text-align: center;
          transition: all 0.3s ease;
          display: inline-block;
        }

        .btn-primary {
          background: #008B9D;
          color: white;
        }

        .btn-primary:hover {
          background: #0094A0;
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 139, 157, 0.3);
        }

        .btn-secondary {
          background: #f6f1e9;
          color: #008B9D;
        }

        .btn-secondary:hover {
          background: #e3fbfa;
        }

        .loading-spinner {
          text-align: center;
          padding: 60px 20px;
          font-size: 18px;
          color: #8a7b6a;
        }

        .error-card {
          background: white;
          border-radius: 24px;
          padding: 60px 40px;
          text-align: center;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
          max-width: 500px;
          margin: 40px auto;
        }

        .error-card h1 {
          font-size: 32px;
          color: #2b2620;
          margin-bottom: 20px;
        }

        .error-card p {
          color: #8a7b6a;
          margin-bottom: 30px;
          font-size: 16px;
        }
      `}</style>
    </section>
  );
}
