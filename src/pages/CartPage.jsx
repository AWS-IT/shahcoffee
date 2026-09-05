// src/pages/CartPage.jsx
import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import AddressSuggest from '../components/AddressSuggest.jsx'
import { TBANK_TERMINAL_KEY, probeTbankWidgetAvailable } from '../utils/tbankWidget.js'

export default function CartPage() {
  const { cart, updateQuantity, removeFromCart, clearCart, totalPrice } = useCart()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [showCheckout, setShowCheckout] = useState(false)
  const [showPaymentButtons, setShowPaymentButtons] = useState(false)
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
  const [stockLoaded, setStockLoaded] = useState(false)
  // null = ещё проверяем серт Минцифры; true = виджет; false = редирект-кнопка
  const [widgetOk, setWidgetOk] = useState(null)
  const [widgetMountTick, setWidgetMountTick] = useState(0)
  const paymentContainerRef = useRef(null)
  const integrationLoadedRef = useRef(false)
  const orderDataRef = useRef(null)
  const payInFlightRef = useRef(null)

  useEffect(() => {
    orderDataRef.current = orderData
  }, [orderData])

  // Проверка доступа к securepay (нужен сертификат Минцифры)
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

  // Виджет только если серт ок
  useEffect(() => {
    if (!showPaymentButtons || widgetOk !== true || integrationLoadedRef.current) {
      return
    }
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
            if (!Number.isFinite(amount) || amount <= 0) {
              throw new Error('Некорректная сумма заказа')
            }

            // Новый orderId на каждую попытку
            const orderId = `order-${Date.now()}`
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
                description: `Заказ на имя ${next.customerData.name}`,
                userId: user?.id || null,
                customerData: next.customerData,
                items: next.items,
                coordinates: next.coordinates,
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
        setLoading(false)
      } catch (err) {
        console.error('T-Bank widget init error:', err)
        // Виджет не поднялся — откатываемся на кнопку-редирект
        setWidgetOk(false)
        setLoading(false)
      }
    }

    loadTBankWidget()
  }, [showPaymentButtons, widgetOk, widgetMountTick, user])

  // Загрузка пунктов выдачи и остатков при открытии формы оформления заказа
  useEffect(() => {
    if (!showCheckout) return
    let cancelled = false
    
    // Загружаем пункты выдачи
    fetch('/api/pickup-points')
      .then((res) => res.ok ? res.json() : [])
      .then((data) => {
        if (!cancelled) {
          const pts = Array.isArray(data) ? data : []
          console.log('📍 Пункты выдачи:', pts.map(p => ({ id: p.id, name: p.name, store_id: p.store_id })))
          setPickupPoints(pts)
        }
      })
      .catch(() => { if (!cancelled) setPickupPoints([]) })
    
    // Загружаем остатки по складам
    fetch('/api/pickup-points/stock')
      .then((res) => res.ok ? res.json() : { loaded: false, data: {} })
      .then((result) => {
        if (!cancelled) {
          console.log('📦 Остатки по складам (loaded:', result.loaded, '):', JSON.stringify(result.data).substring(0, 500))
          console.log('🛒 Корзина для фильтрации:', cart.map(c => ({ id: c.id, name: c.name, code: c.code })))
          setStockByStore(result.data || {})
          setStockLoaded(result.loaded === true)
        }
      })
      .catch(() => { if (!cancelled) { setStockByStore({}); setStockLoaded(false) } })
    
    return () => { cancelled = true }
  }, [showCheckout])

  // Пункты выдачи с остатками — скрываем те, где нет товаров из корзины
  const availablePickupPoints = (() => {
    console.log('🔍 Фильтрация ПВЗ: stockLoaded=', stockLoaded, 'cart.length=', cart.length,
      'pickupPoints=', pickupPoints.length, 'stockByStore keys=', Object.keys(stockByStore))
    return pickupPoints.filter(point => {
      // Если у пункта нет привязки к складу — показываем всегда
      if (!point.store_id) {
        console.log(`  ✅ ${point.name}: нет store_id — показываем`)
        return true
      }
      // Если API остатков не загрузился (ошибка/недоступен) — показываем всё (fail-open)
      if (!stockLoaded) {
        console.log(`  ⚠️ ${point.name}: остатки не загружены — показываем (fail-open)`)
        return true
      }
      const storeStock = stockByStore[point.store_id]
      console.log(`  📋 ${point.name}: store_id=${point.store_id}, storeStock=`, storeStock ? `${storeStock.length} items` : 'undefined')
      // Если склад есть в ответе, но массив пустой или все stock <= 0 — скрываем
      if (!storeStock || storeStock.length === 0) {
        console.log(`  ❌ ${point.name}: нет остатков — скрываем`)
        return false
      }
      // Если корзина пуста — показываем только пункты, где хоть что-то есть
      if (cart.length === 0) {
        const hasAny = storeStock.some(s => s.stock > 0)
        console.log(`  ${hasAny ? '✅' : '❌'} ${point.name}: корзина пуста, есть остатки=${hasAny}`)
        return hasAny
      }
      // Проверяем, есть ли хотя бы один товар из корзины на этом складе
      const found = cart.some(cartItem => {
        const cartName = (cartItem.name || '').trim().toLowerCase()
        const cartCode = (cartItem.code || '').trim()
        const cartId = cartItem.id || null
        return storeStock.some(s => {
          if (s.stock <= 0) return false
          const sName = (s.name || '').trim().toLowerCase()
          const sCode = (s.code || '').trim()
          const match = (cartId && s.productId && s.productId === cartId) ||
                 sName === cartName ||
                 (cartCode && sCode && sCode === cartCode)
          if (match) console.log(`    ✅ Совпадение: cart="${cartItem.name}" (id=${cartId}) ↔ stock="${s.name}" (id=${s.productId})`)
          return match
        })
      })
      console.log(`  ${found ? '✅' : '❌'} ${point.name}: товар из корзины найден=${found}`)
      return found
    })
  })()

    // Предупреждение, если товары из корзины находятся на разных пунктах выдачи
  const cartItemsByPickup = (() => {
    const result = new Map() // pickupPointId -> [cartItemNames]
    for (const cartItem of cart) {
      const cartName = (cartItem.name || '').trim().toLowerCase()
      const cartCode = (cartItem.code || '').trim()
      const cartId = cartItem.id || null
      for (const point of availablePickupPoints) {
        if (!point.store_id) continue
        const storeStock = stockByStore[point.store_id]
        if (!storeStock) continue
        const hasItem = storeStock.some(s => {
          if (s.stock <= 0) return false
          const sName = (s.name || '').trim().toLowerCase()
          const sCode = (s.code || '').trim()
          return (cartId && s.productId && s.productId === cartId) ||
                 sName === cartName ||
                 (cartCode && sCode && sCode === cartCode)
        })
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
      setShowPaymentButtons(true)
      setLoading(false)
      
    } catch (err) {
      console.error('Ошибка оформления заказа:', err)
      setError(err.message || 'Ошибка при оформлении заказа')
      setLoading(false)
    }
  }

  // Редирект на платёжную страницу T-Bank (pay.tbank.ru — обычный LE-сертификат,
  // в отличие от виджета на securepay.tinkoff.ru с корнем Минцифры)
  const handlePayment = async () => {
    if (!orderData) return

    const amount = Number(orderData.totalPrice)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Некорректная сумма заказа')
      return
    }

    setLoading(true)
    setError(null)

    // Новый orderId на каждую попытку — T-Bank отклоняет повтор с тем же OrderId
    const orderId = `order-${Date.now()}`
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
          description: `Заказ на имя ${nextOrder.customerData.name}`,
          userId: user?.id || null,
          customerData: nextOrder.customerData,
          items: nextOrder.items,
          coordinates: nextOrder.coordinates,
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

      if (!paymentData.PaymentURL) {
        throw new Error('Не получен URL для оплаты')
      }

      window.location.href = paymentData.PaymentURL
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

                  {widgetOk === null && (
                    <div className="loading-spinner">
                      <p>Подбираем способ оплаты…</p>
                    </div>
                  )}

                  {widgetOk === true && (
                    <div className="sbp-primary-block">
                      <div className="sbp-badge">Быстро и без комиссии</div>
                      <div className="sbp-icon-row">
                        <span className="sbp-title">Оплата через СБП / T-Pay</span>
                      </div>
                      <div
                        ref={paymentContainerRef}
                        id="tbank-payment-container"
                        className="tbank-payment-buttons"
                        style={{ minHeight: '60px' }}
                      />
                      <p className="payment-hint" style={{ marginTop: 12 }}>
                        или{' '}
                        <button
                          type="button"
                          onClick={handlePayment}
                          disabled={loading}
                          className="btn-link"
                          style={{ display: 'inline', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                        >
                          оплатить на странице банка
                        </button>
                      </p>
                    </div>
                  )}

                  {widgetOk === false && (
                    <>
                      <button
                        type="button"
                        onClick={handlePayment}
                        disabled={loading}
                        className="btn-primary btn-lg"
                        style={{ width: '100%', marginTop: '12px' }}
                      >
                        {loading ? 'Переход к оплате…' : 'Оплатить'}
                      </button>
                      <p className="payment-hint">
                        СБП, T-Pay и карта — на защищённой странице T-Bank
                      </p>
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