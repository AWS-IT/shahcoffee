// src/pages/ServiceCheckoutPage.jsx
import React, { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { TBANK_TERMINAL_KEY, probeTbankWidgetAvailable } from '../utils/tbankWidget.js'

export default function ServiceCheckoutPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

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
  const [orderData, setOrderData] = useState(null)
  const [widgetOk, setWidgetOk] = useState(null)
  const [widgetMountTick, setWidgetMountTick] = useState(0)
  const paymentContainerRef = useRef(null)
  const integrationLoadedRef = useRef(false)
  const orderDataRef = useRef(null)
  const payInFlightRef = useRef(null)

  useEffect(() => {
    orderDataRef.current = orderData
  }, [orderData])

  useEffect(() => {
    const loadService = async () => {
      try {
        const r = await fetch(`/api_ms/entity/service/${id}?expand=images`)
        if (r.ok) setService(await r.json())
      } catch (err) {
        console.error('Ошибка загрузки услуги:', err)
      } finally {
        setLoading(false)
      }
    }
    loadService()
  }, [id])

  useEffect(() => {
    if (user?.first_name && !formData.name) {
      setFormData(prev => ({ ...prev, name: user.first_name }))
    }
  }, [user])

  useEffect(() => {
    if (!showPaymentButtons) return
    let cancelled = false
    setWidgetOk(null)
    integrationLoadedRef.current = false
    probeTbankWidgetAvailable().then((ok) => {
      if (!cancelled) setWidgetOk(ok)
    })
    return () => { cancelled = true }
  }, [showPaymentButtons])

  useEffect(() => {
    if (!showPaymentButtons || widgetOk !== true || integrationLoadedRef.current) return
    if (!paymentContainerRef.current) {
      const id = requestAnimationFrame(() => setWidgetMountTick((t) => t + 1))
      return () => cancelAnimationFrame(id)
    }

    const loadTBankWidget = async () => {
      try {
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
          if (payInFlightRef.current) return payInFlightRef.current
          payInFlightRef.current = (async () => {
            const current = orderDataRef.current
            if (!current) throw new Error('Данные заказа не готовы')
            const amount = Number(current.totalPrice)
            if (!Number.isFinite(amount) || amount <= 0) throw new Error('Некорректная сумма заказа')

            const orderId = `svc-${Date.now()}`
            const next = { ...current, orderId }
            orderDataRef.current = next
            setOrderData(next)
            localStorage.setItem('pendingOrder', JSON.stringify(next))

            const response = await fetch('/api/tbank/initiate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId,
                amount,
                description: `Услуга: ${service.name}`,
                userId: user?.id || null,
                customerData: next.customerData,
                items: next.items,
                coordinates: null,
                widget: true,
                data: {
                  customerEmail: next.customerData.email,
                  customerPhone: next.customerData.phone,
                  customerName: next.customerData.name,
                  customerAddress: next.customerData.address,
                }
              }),
            })
            const paymentData = await response.json().catch(() => ({}))
            if (!response.ok) {
              const details = paymentData?.body?.Details || paymentData?.body?.Message || paymentData?.error
              throw new Error(details || 'Ошибка при инициировании платежа')
            }
            if (!paymentData.PaymentURL) throw new Error('Не получен URL для оплаты')
            return paymentData.PaymentURL
          })()
          try {
            return await payInFlightRef.current
          } finally {
            setTimeout(() => { payInFlightRef.current = null }, 1500)
          }
        }

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
        setWidgetOk(false)
        setFormLoading(false)
      }
    }
    loadTBankWidget()
  }, [showPaymentButtons, widgetOk, widgetMountTick, user, service])

  const priceRub = (() => {
    if (!service) return 0
    const entry = service.salePrices?.find(p => p.priceType?.name === 'Цена продажи')
    return entry ? entry.value / 100 : 0
  })()

  const totalPrice = priceRub * quantity

  if (loading) return <div className="loading">Загрузка...</div>
  if (!service) return (
    <section className="service-checkout">
      <div className="container">
        <h1>Услуга не найдена</h1>
        <Link to="/" className="btn-primary">На главную</Link>
      </div>
    </section>
  )

  const formValid = formData.name.trim() && formData.phone.trim() && formData.email.trim()

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setFormLoading(true)
    try {
      const orderId = `svc-${Date.now()}`
      const orderInfo = {
        orderId,
        customerData: {
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          address: formData.comment ? `Услуга. ${formData.comment}` : 'Услуга — адрес не требуется',
        },
        items: [{
          id: service.id,
          name: service.name,
          code: service.code || null,
          priceRub,
          quantity,
        }],
        totalPrice,
        createdAt: new Date().toISOString(),
      }
      localStorage.setItem('pendingOrder', JSON.stringify(orderInfo))
      setOrderData(orderInfo)
      setShowPaymentButtons(true)
      setFormLoading(false)
    } catch (err) {
      console.error('Ошибка оформления:', err)
      setError(err.message || 'Ошибка при оформлении заказа')
      setFormLoading(false)
    }
  }

  const handlePayment = async () => {
    if (!orderData) return
    const amount = Number(orderData.totalPrice)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Некорректная сумма заказа')
      return
    }
    setFormLoading(true)
    setError(null)
    const orderId = `svc-${Date.now()}`
    const nextOrder = { ...orderData, orderId }
    setOrderData(nextOrder)
    localStorage.setItem('pendingOrder', JSON.stringify(nextOrder))
    try {
      const response = await fetch('/api/tbank/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          amount,
          description: `Услуга: ${service.name}`,
          userId: user?.id || null,
          customerData: nextOrder.customerData,
          items: nextOrder.items,
          coordinates: null,
          data: {
            customerEmail: nextOrder.customerData.email,
            customerPhone: nextOrder.customerData.phone,
            customerName: nextOrder.customerData.name,
            customerAddress: nextOrder.customerData.address,
          }
        }),
      })
      const paymentData = await response.json().catch(() => ({}))
      if (!response.ok) {
        const details = paymentData?.body?.Details || paymentData?.body?.Message || paymentData?.error
        throw new Error(details || 'Ошибка при инициировании платежа')
      }
      if (!paymentData.PaymentURL) throw new Error('Не получен URL для оплаты')
      window.location.href = paymentData.PaymentURL
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
                  <input id="name" type="text" name="name" placeholder="Иван Петров"
                    value={formData.name} onChange={handleChange} required className="form-input" />
                </div>
                <div className="form-group">
                  <label htmlFor="phone">Телефон *</label>
                  <input id="phone" type="tel" name="phone" placeholder="+7 (999) 123-45-67"
                    value={formData.phone} onChange={handleChange} required className="form-input" />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Email *</label>
                  <input id="email" type="email" name="email" placeholder="ivan@example.com"
                    value={formData.email} onChange={handleChange} required className="form-input" />
                </div>
                <div className="form-group">
                  <label htmlFor="comment">Комментарий к заказу</label>
                  <textarea id="comment" name="comment" placeholder="Дополнительная информация..."
                    value={formData.comment} onChange={handleChange} className="form-input" rows={3} />
                </div>
                <div className="form-group">
                  <label htmlFor="qty">Количество</label>
                  <input id="qty" type="number" min={1} value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="form-input" />
                </div>
                <p className="service-checkout__note">
                  Данная услуга не требует ввода адреса доставки. После оплаты наш менеджер свяжется с вами.
                </p>
                {error && <div className="error-message">{error}</div>}
                <button type="submit" disabled={formLoading || !formValid} className="btn-primary btn-lg">
                  {formLoading ? 'Обработка...' : 'Перейти к оплате'}
                </button>
                <button type="button" onClick={() => navigate(`/service/${id}`)} className="btn-secondary">
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

                {widgetOk === null && (
                  <div className="loading-spinner"><p>Подбираем способ оплаты…</p></div>
                )}

                {widgetOk === true && (
                  <div className="sbp-primary-block">
                    <div className="sbp-badge">Быстро и без комиссии</div>
                    <div className="sbp-icon-row">
                      <span className="sbp-title">Оплата через СБП / T-Pay</span>
                    </div>
                    <div
                      ref={paymentContainerRef}
                      id="tbank-payment-container-svc"
                      className="tbank-payment-buttons"
                      style={{ minHeight: '60px' }}
                    />
                    <p className="payment-hint" style={{ marginTop: 12 }}>
                      или{' '}
                      <button type="button" onClick={handlePayment} disabled={formLoading}
                        className="btn-link"
                        style={{ display: 'inline', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}>
                        оплатить на странице банка
                      </button>
                    </p>
                  </div>
                )}

                {widgetOk === false && (
                  <>
                    <button type="button" onClick={handlePayment} disabled={formLoading}
                      className="btn-primary btn-lg" style={{ width: '100%', marginTop: '12px' }}>
                      {formLoading ? 'Переход к оплате…' : 'Оплатить'}
                    </button>
                    <p className="payment-hint">СБП, T-Pay и карта — на защищённой странице T-Bank</p>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentButtons(false)
                    setOrderData(null)
                    setWidgetOk(null)
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
          <div className="checkout-summary">
            <h2>Ваш заказ</h2>
            <div className="order-items">
              <div className="order-item">
                <div className="order-item__info">
                  <h3>{service.name}</h3>
                  <p className="order-item__unit-price">{priceRub.toLocaleString('ru-RU')} ₽ × {quantity}</p>
                </div>
                <p className="order-item__price">{totalPrice.toLocaleString('ru-RU')} ₽</p>
              </div>
            </div>
            <div className="order-total">
              <p>Итого:</p>
              <p className="total-price">{totalPrice.toLocaleString('ru-RU')} ₽</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
