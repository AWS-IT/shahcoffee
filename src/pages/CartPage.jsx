// src/pages/CartPage.jsx
import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import AddressSuggest from '../components/AddressSuggest.jsx'

// Ключ терминала T-Bank
const TBANK_TERMINAL_KEY = '1769767428904';

export default function CartPage() {
  const { cart, updateQuantity, removeFromCart, clearCart, totalPrice } = useCart()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [showCheckout, setShowCheckout] = useState(false)
  const [showPaymentButtons, setShowPaymentButtons] = useState(false)
  const [showOtherMethods, setShowOtherMethods] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [coordinates, setCoordinates] = useState(null)
  const [orderData, setOrderData] = useState(null)
  const [pickupPoints, setPickupPoints] = useState([])
  const [stockByStore, setStockByStore] = useState({})
  const paymentContainerRef = useRef(null)
  const integrationLoadedRef = useRef(false)

  // Загрузка и инициализация T-Bank виджета
  useEffect(() => {
    if (!showPaymentButtons || !paymentContainerRef.current || integrationLoadedRef.current) {
      return
    }

    // Функция получения PaymentURL должна быть определена внутри useEffect
    // чтобы использовать актуальные данные orderData
    const loadTBankWidget = async () => {
      // Загружаем скрипт integration.js
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

      // Callback для получения PaymentURL — вызывается при нажатии на кнопку оплаты
      const paymentStartCallback = async () => {
        console.log('paymentStartCallback called, orderData:', orderData)
        
        if (!orderData) {
          console.error('No order data available')
          throw new Error('Данные заказа не готовы')
        }

        // Используем данные из orderData, т.к. cart мог измениться
        const response = await fetch('/api/tbank/initiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: orderData.orderId,
            amount: orderData.totalPrice,
            description: `Заказ на имя ${orderData.customerData.name}`,
            userId: user?.id || null,
            customerData: orderData.customerData,
            items: orderData.items,
            coordinates: orderData.coordinates,
            data: {
              customerEmail: orderData.customerData.email,
              customerPhone: orderData.customerData.phone,
              customerName: orderData.customerData.name,
              customerAddress: orderData.customerData.address,
            }
          }),
        })

        if (!response.ok) {
          throw new Error('Ошибка при инициировании платежа')
        }

        const paymentData = await response.json()
        console.log('T-Bank payment init response:', paymentData)

        if (!paymentData.PaymentURL) {
          throw new Error('Не получен URL для оплаты')
        }

        return paymentData.PaymentURL
      }

      // Инициализируем виджет с paymentStartCallback в конфигурации
      const initConfig = {
        terminalKey: TBANK_TERMINAL_KEY,
        product: 'eacq',
        features: {
          payment: {
            container: paymentContainerRef.current,
            paymentStartCallback: paymentStartCallback,
          }
        }
      }

      try {
        const integration = await window.PaymentIntegration.init(initConfig)
        console.log('T-Bank integration initialized with payment buttons')
        
        integrationLoadedRef.current = true
        setLoading(false)
        
        console.log('T-Bank payment buttons ready')
      } catch (err) {
        console.error('T-Bank widget init error:', err)
        setError('Ошибка загрузки платёжных кнопок: ' + err.message)
        setLoading(false)
      }
    }

    loadTBankWidget()
  }, [showPaymentButtons, orderData, totalPrice, formData, clearCart, navigate])

  // Загрузка пунктов выдачи и остатков при открытии формы оформления заказа
  useEffect(() => {
    if (!showCheckout) return
    let cancelled = false
    
    // Загружаем пункты выдачи
    fetch('/api/pickup-points')
      .then((res) => res.ok ? res.json() : [])
      .then((data) => { if (!cancelled) setPickupPoints(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setPickupPoints([]) })
    
    // Загружаем остатки по складам
    fetch('/api/pickup-points/stock')
      .then((res) => res.ok ? res.json() : {})
      .then((data) => { if (!cancelled) setStockByStore(data || {}) })
      .catch(() => { if (!cancelled) setStockByStore({}) })
    
    return () => { cancelled = true }
  }, [showCheckout])

  // Пункты выдачи с остатками — скрываем те, где нет товаров из корзины
  const availablePickupPoints = pickupPoints.filter(point => {
    // Если у пункта нет привязки к складу — показываем всегда (доставка)
    if (!point.store_id) return true
    // Если нет данных по остаткам — показываем (не блокируем)
    const storeStock = stockByStore[point.store_id]
    if (!storeStock || storeStock.length === 0) return false
    // Проверяем, есть ли хотя бы один товар из корзины на этом складе
    return cart.some(cartItem => {
      return storeStock.some(s => s.stock > 0 && (
        s.name === cartItem.name || s.code === cartItem.code
      ))
    })
  })

  // Предупреждение, если товары из корзины находятся на разных пунктах выдачи
  const cartItemsByPickup = (() => {
    const result = new Map() // pickupPointId -> [cartItemNames]
    for (const cartItem of cart) {
      for (const point of availablePickupPoints) {
        if (!point.store_id) continue
        const storeStock = stockByStore[point.store_id]
        if (!storeStock) continue
        const hasItem = storeStock.some(s => s.stock > 0 && (
          s.name === cartItem.name || s.code === cartItem.code
        ))
        if (hasItem) {
          if (!result.has(point.id)) result.set(point.id, { point, items: [] })
          result.get(point.id).items.push(cartItem.name)
        }
      }
    }
    return result
  })()
  const multiPickupWarning = cartItemsByPickup.size > 1

  const handleAddressChange = (address) => {
    setFormData({ ...formData, address })
  }

  const handleAddressSelect = (suggestion) => {
    setFormData({ ...formData, address: suggestion.address })
    setCoordinates(suggestion.coordinates)
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleCheckout = async (e) => {
    e.preventDefault()
    setError(null)

    // Проверяем что адрес выбран из списка
    if (!coordinates) {
      setError('Пожалуйста, выберите адрес из списка подсказок')
      return
    }

    setLoading(true)

    try {
      // Генерируем orderId
      const orderId = `order-${Date.now()}`

      // Сохраняем данные заказа в localStorage и state
      const orderInfo = {
        orderId,
        customerData: formData,
        coordinates,
        items: cart,
        totalPrice,
        createdAt: new Date().toISOString(),
      }
      
      localStorage.setItem('pendingOrder', JSON.stringify(orderInfo))
      setOrderData(orderInfo)
      
      // Показываем кнопки оплаты
      setShowPaymentButtons(true)
      integrationLoadedRef.current = false
      setLoading(false)
      
    } catch (err) {
      console.error('Ошибка оформления заказа:', err)
      setError(err.message || 'Ошибка при оформлении заказа')
      setLoading(false)
    }
  }

  // Альтернативная оплата — редирект на стандартную форму T-Bank
  const handleFallbackPayment = async () => {
    if (!orderData) return
    
    setLoading(true)
    setError(null)
    
    try {
      // Используем данные из orderData
      const response = await fetch('/api/tbank/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderData.orderId,
          amount: orderData.totalPrice,
          description: `Заказ на имя ${orderData.customerData.name}`,
          userId: user?.id || null,
          customerData: orderData.customerData,
          items: orderData.items,
          coordinates: orderData.coordinates,
          data: {
            customerEmail: orderData.customerData.email,
            customerPhone: orderData.customerData.phone,
            customerName: orderData.customerData.name,
            customerAddress: orderData.customerData.address,
          }
        }),
      })

      if (!response.ok) {
        throw new Error('Ошибка при инициировании платежа')
      }

      const paymentData = await response.json()
      
      if (paymentData.PaymentURL) {
        window.location.href = paymentData.PaymentURL
      } else {
        throw new Error('Не получен URL для оплаты')
      }
    } catch (err) {
      console.error('Ошибка оплаты:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  if (cart.length === 0) {
    return (
      <section className="cart-page cart-empty">
        <div className="container">
          <h1>Корзина пуста</h1>
          <p>Добавьте товары из каталога</p>
          <Link to="/catalog" className="btn-primary">Перейти в каталог</Link>
        </div>
      </section>
    )
  }

  if (showCheckout) {
    return (
      <section className="cart-page checkout-form-section">
        <div className="container">
          <h1>Оформление заказа</h1>

          <div className="checkout-layout">
            <div className="checkout-form">
              {!showPaymentButtons ? (
                <form onSubmit={handleCheckout}>
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
                      placeholder="Начните вводить адрес или выберите пункт выдачи..."
                      pickupPoints={availablePickupPoints}
                    />
                    {coordinates && (
                      <p className="address-confirmed">✓ Адрес подтверждён</p>
                    )}
                  </div>

                  {multiPickupWarning && (
                    <div className="warning-message" style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#856404' }}>
                      <strong>⚠ Внимание:</strong> Товары из вашей корзины находятся в разных пунктах выдачи.
                      <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                        {[...cartItemsByPickup.values()].map(({ point, items }) => (
                          <li key={point.id}>
                            <strong>{point.name}</strong>: {items.join(', ')}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

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
                    onClick={() => setShowCheckout(false)}
                    className="btn-secondary"
                  >
                    Вернуться в корзину
                  </button>
                </form>
              ) : (
                <div className="payment-section">
                  <h2>Оплата заказа</h2>
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

                  {/* Основной блок — СБП (приоритетный способ) */}
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
                    <p className="sbp-description">
                      Моментальная оплата через Систему быстрых платежей — прямо из приложения вашего банка
                    </p>

                    {/* Контейнер для кнопок T-Bank (СБП, T-Pay) */}
                    <div 
                      ref={paymentContainerRef} 
                      id="tbank-payment-container"
                      className="tbank-payment-buttons"
                      style={{ minHeight: '60px' }}
                    />
                  </div>

                  {/* Другие способы оплаты — скрыты за кнопкой */}
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
                          disabled={loading}
                          className="btn-secondary btn-lg"
                        >
                          💳 Оплатить банковской картой
                        </button>
                        <p className="payment-hint">
                          Перейти на защищённую страницу T-Bank для оплаты картой
                        </p>
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
    )
  }

  return (
    <section className="cart-page">
      <div className="container">
        {/*<h1>Корзина</h1>*/}

        <div className="cart-items">
          {cart.map(item => (
            <div key={item.id} className="cart-item">
              {item.image ? (
                <img src={item.image} alt={item.name} className="cart-item__image" />
              ) : (
                <div className="cart-item__placeholder">Нет фото</div>
              )}

              <div className="cart-item__info">
                <h3 className="cart-item__name">{item.name}</h3>
                {item.code && <p className="cart-item__code">Артикул: {item.code}</p>}

                <div className="quantity-selector">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                  >
                    −
                  </button>
                  <span className="quantity-value">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                </div>

                <p className="cart-item__price">
                  {item.priceRub.toLocaleString('ru-RU')} ₽ / уп.
                </p>
                <p className="cart-item__total">
                  <strong>Сумма: {(item.priceRub * item.quantity).toLocaleString('ru-RU')} ₽</strong>
                </p>

                <button
                  onClick={() => removeFromCart(item.id)}
                  className="remove-btn"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="cart-summary">
          <div className="cart-total">
            <h2>Итого: {totalPrice.toLocaleString('ru-RU')} ₽</h2>
          </div>

          <div className="cart-actions">
            <button onClick={() => setShowCheckout(true)} className="btn-primary btn-lg">
              Оформить заказ
            </button>

            <button onClick={clearCart} className="btn-secondary">
              Очистить корзину
            </button>
          </div>
        </div>
        
      </div>
    </section>
  )
}