// src/pages/ServiceCheckoutPage.jsx
import React, { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const TBANK_TERMINAL_KEY = '1769767428904'

export default function ServiceCheckoutPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()

  const [searchParams] = useSearchParams()
  const [quantity, setQuantity] = useState(() => {
    const q = parseInt(searchParams.get('qty'), 10)
    return q > 0 ? q : 1
  })
  const [service, setService] = useState(null)
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    name: user?.first_name || '',
    phone: '',
    email: '',
    comment: '',
  })
  const [formLoading, setFormLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showPaymentButtons, setShowPaymentButtons] = useState(false)
  const [showOtherMethods, setShowOtherMethods] = useState(false)
  const [orderData, setOrderData] = useState(null)
  const paymentContainerRef = useRef(null)
  const integrationLoadedRef = useRef(false)

  // Загрузка услуги
  useEffect(() => {
    const loadService = async () => {
      try {
        const r = await fetch(`/api_ms/entity/service/${id}?expand=images`)
        if (r.ok) {
          const data = await r.json()
          setService(data)
        }
      } catch (err) {
        console.error('Ошибка загрузки услуги:', err)
      } finally {
        setLoading(false)
      }
    }
    loadService()
  }, [id])

  // Обновление имени из user
  useEffect(() => {
    if (user?.first_name && !formData.name) {
      setFormData(prev => ({ ...prev, name: user.first_name }))
    }
  }, [user])

  const priceRub = (() => {
    if (!service) return 0
    const entry = service.salePrices?.find(p => p.priceType?.name === 'Цена продажи')
    return entry ? entry.value / 100 : 0
  })()

  const totalPrice = priceRub * quantity

  // T-Bank виджет
  useEffect(() => {
    if (!showPaymentButtons || !paymentContainerRef.current || integrationLoadedRef.current) return

    const loadTBankWidget = async () => {
      if (!window.PaymentIntegration) {
        const script = document.createElement('script')
        script.src = 'https://integrationjs.tbank.ru/integration.js'
        script.async = true
        await new Promise((resolve, reject) => {
          script.onload = resolve
          script.onerror = reject
          document.body.appendChild(script)
        })
      }

      const paymentStartCallback = async () => {
        if (!orderData) throw new Error('Данные заказа не готовы')

        const response = await fetch('/api/tbank/initiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: orderData.orderId,
            amount: orderData.totalPrice,
            description: `Услуга: ${service.name}`,
            userId: user?.id || null,
            customerData: orderData.customerData,
            items: orderData.items,
            coordinates: null,
            data: {
              customerEmail: orderData.customerData.email,
              customerPhone: orderData.customerData.phone,
              customerName: orderData.customerData.name,
              customerAddress: 'Услуга — адрес не требуется',
            }
          }),
        })

        if (!response.ok) throw new Error('Ошибка при инициировании платежа')
        const paymentData = await response.json()
        if (!paymentData.PaymentURL) throw new Error('Не получен URL для оплаты')
        return paymentData.PaymentURL
      }

      try {
        await window.PaymentIntegration.init({
          terminalKey: TBANK_TERMINAL_KEY,
          product: 'eacq',
          features: {
            payment: {
              container: paymentContainerRef.current,
              paymentStartCallback,
            }
          }
        })
        integrationLoadedRef.current = true
        setFormLoading(false)
      } catch (err) {
        console.error('T-Bank widget error:', err)
        setError('Ошибка загрузки платёжных кнопок: ' + err.message)
        setFormLoading(false)
      }
    }

    loadTBankWidget()
  }, [showPaymentButtons, orderData, service, user])

  if (loading) return <div className="loading">Загрузка...</div>
  if (!service) return (
    <section className="service-checkout">
      <div className="container">
        <h1>Услуга не найдена</h1>
        <Link to="/" className="btn-primary">На главную</Link>
      </div>
    </section>
  )

  if (!isAuthenticated) {
    return (
      <section className="service-checkout">
        <div className="container">
          <div className="auth-required">
            <h1>Требуется авторизация</h1>
            <p>Для оформления заказа необходимо войти через Telegram</p>
            <Link to="/" className="btn-primary">На главную</Link>
          </div>
        </div>
      </section>
    )
  }

  const formValid = formData.name && formData.phone && formData.email

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setFormLoading(true)

    try {
      const orderId = `svc-${Date.now()}`
      const items = [{
        id: service.id,
        name: service.name,
        code: service.code || null,
        priceRub,
        quantity,
        entityType: 'service',
        image: null,
      }]

      const customerData = {
        ...formData,
        address: 'Услуга — адрес не требуется',
      }

      const orderInfo = {
        orderId,
        customerData,
        coordinates: null,
        items,
        totalPrice,
        createdAt: new Date().toISOString(),
      }
      setOrderData(orderInfo)

      // Сохраняем заказ в БД
      const saveRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          userId: user?.id || null,
          customerData,
          coordinates: null,
          items,
          totalPrice,
        })
      })

      if (!saveRes.ok) {
        const errBody = await saveRes.json().catch(() => ({}))
        throw new Error(errBody.error || 'Ошибка сохранения заказа')
      }

      setShowPaymentButtons(true)
      integrationLoadedRef.current = false
      setFormLoading(false)
    } catch (err) {
      console.error('Ошибка оформления:', err)
      setError(err.message || 'Ошибка при оформлении заказа')
      setFormLoading(false)
    }
  }

  // Альтернативная оплата через redirect
  const handleFallbackPayment = async () => {
    if (!orderData) return
    setFormLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/tbank/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderData.orderId,
          amount: orderData.totalPrice,
          description: `Услуга: ${service.name}`,
          userId: user?.id || null,
          customerData: orderData.customerData,
          items: orderData.items,
          coordinates: null,
          data: {
            customerEmail: orderData.customerData.email,
            customerPhone: orderData.customerData.phone,
            customerName: orderData.customerData.name,
            customerAddress: 'Услуга — адрес не требуется',
          }
        }),
      })

      if (!response.ok) throw new Error('Ошибка при инициировании платежа')
      const paymentData = await response.json()
      if (paymentData.PaymentURL) {
        window.location.href = paymentData.PaymentURL
      } else {
        throw new Error('Не получен URL для оплаты')
      }
    } catch (err) {
      console.error('Ошибка оплаты:', err)
      setError(err.message)
      setFormLoading(false)
    }
  }

  return (
    <section className="service-checkout">
      <div className="container">
        <div className="breadcrumbs">
          <Link to="/">Главная</Link> → <Link to={`/service/${id}`}>{service.name}</Link> → <span>Оформление</span>
        </div>

        <h1>Оформление услуги</h1>

        <div className="checkout-layout">
          <div className="checkout-form">
            {!showPaymentButtons ? (
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="name">Ваше имя *</label>
                  <input
                    id="name" type="text" name="name"
                    placeholder="Иван Петров"
                    value={formData.name} onChange={handleChange}
                    required className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="phone">Телефон *</label>
                  <input
                    id="phone" type="tel" name="phone"
                    placeholder="+7 (999) 123-45-67"
                    value={formData.phone} onChange={handleChange}
                    required className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email *</label>
                  <input
                    id="email" type="email" name="email"
                    placeholder="ivan@example.com"
                    value={formData.email} onChange={handleChange}
                    required className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="comment">Комментарий к заказу</label>
                  <textarea
                    id="comment" name="comment"
                    placeholder="Дополнительная информация, пожелания..."
                    value={formData.comment} onChange={handleChange}
                    className="form-input" rows={3}
                  />
                </div>

                <p className="service-checkout__note">
                  Данная услуга не требует ввода адреса доставки. После оплаты наш менеджер свяжется с вами для обсуждения деталей.
                </p>

                {error && <div className="error-message">{error}</div>}

                <button
                  type="submit"
                  disabled={formLoading || !formValid}
                  className="btn-primary btn-lg"
                >
                  {formLoading ? 'Обработка...' : 'Перейти к оплате'}
                </button>

                <button
                  type="button"
                  onClick={() => navigate(`/service/${id}`)}
                  className="btn-secondary"
                >
                  ← Назад к описанию
                </button>
              </form>
            ) : (
              <div className="payment-section">
                <h2>Оплата услуги</h2>
                <p className="payment-info">
                  Заказ #{orderData?.orderId}<br />
                  Сумма: <strong>{totalPrice.toLocaleString('ru-RU')} ₽</strong>
                </p>

                {error && <div className="error-message">{error}</div>}

                {formLoading && (
                  <div className="loading-spinner"><p>Загрузка способов оплаты...</p></div>
                )}

                <div className="sbp-primary-block">
                  <div className="sbp-badge">Быстро и без комиссии</div>
                  <div className="sbp-icon-row">
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="40" height="40" rx="10" fill="#fff"/>
                      <path d="M20 6L12 10.5V19.5L20 24L28 19.5V10.5L20 6Z" fill="#5B2D8E"/>
                      <path d="M20 24L12 19.5V28.5L20 33L28 28.5V19.5L20 24Z" fill="#F26F23"/>
                      <path d="M12 10.5L20 15L28 10.5" stroke="#1FA8F1" strokeWidth="1.5"/>
                      <path d="M20 15V24" stroke="#35B44F" strokeWidth="1.5"/>
                    </svg>
                    <span className="sbp-title">Оплата через СБП</span>
                  </div>
                  <div
                    ref={paymentContainerRef}
                    id="tbank-payment-container-svc"
                    className="tbank-payment-buttons"
                    style={{ minHeight: '60px' }}
                  />
                </div>

                <div className="other-methods-section">
                  <button
                    type="button"
                    className="other-methods-toggle"
                    onClick={() => setShowOtherMethods(!showOtherMethods)}
                  >
                    {showOtherMethods ? '▲ Скрыть другие способы' : '▼ Другие способы оплаты'}
                  </button>
                  {showOtherMethods && (
                    <div className="other-methods-content">
                      <button
                        type="button"
                        onClick={handleFallbackPayment}
                        disabled={formLoading}
                        className="btn-secondary btn-lg"
                      >
                        Оплатить банковской картой
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentButtons(false)
                    setOrderData(null)
                    setShowOtherMethods(false)
                    integrationLoadedRef.current = false
                  }}
                  className="btn-link"
                  style={{ marginTop: '20px' }}
                >
                  ← Изменить данные заказа
                </button>
              </div>
            )}
          </div>

          {/* Сводка */}
          <div className="checkout-summary">
            <h2>Ваш заказ</h2>
            <div className="order-items">
              <div className="order-item">
                <div className="order-item__info">
                  <p className="order-item__name">{service.name}</p>
                  <p className="order-item__quantity">Кол-во: {quantity}</p>
                  <p className="order-item__unit-price">{priceRub.toLocaleString('ru-RU')} ₽ × {quantity}</p>
                </div>
                <p className="order-item__price">{totalPrice.toLocaleString('ru-RU')} ₽</p>
              </div>
            </div>
            <div className="service-checkout__qty-change">
              <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="qty-btn" disabled={showPaymentButtons}>−</button>
              <span className="qty-value">{quantity}</span>
              <button onClick={() => setQuantity(q => q + 1)} className="qty-btn" disabled={showPaymentButtons}>+</button>
            </div>
            <div className="order-total">
              <h3>Итого к оплате:</h3>
              <p className="total-price">{totalPrice.toLocaleString('ru-RU')} ₽</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
