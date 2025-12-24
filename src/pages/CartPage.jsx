// src/pages/CartPage.jsx
import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'

export default function CartPage() {
  const { cart, updateQuantity, removeFromCart, clearCart, totalPrice } = useCart()
  const navigate = useNavigate()
  const [showCheckout, setShowCheckout] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleCheckout = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // InvId в Robokassa должен быть компактным - используем только последние 10 цифр timestamp + 3 случайные
      const timestamp = Date.now().toString().slice(-10)
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
      const orderId = `${timestamp}${random}`
      const description = `Заказ кофе на имя ${formData.name}`

      const response = await fetch('/api/robokassa/init-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          amount: totalPrice.toFixed(2),
          description,
          customerEmail: formData.email,
          // Отправляем данные заказа на сервер для создания отгрузки после оплаты
          customerData: {
            name: formData.name,
            phone: formData.phone,
            email: formData.email,
            address: formData.address,
          },
          items: cart.map(item => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            priceRub: item.priceRub,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error('Ошибка при инициировании платежа')
      }

      const paymentData = await response.json()

      localStorage.setItem('pendingOrder', JSON.stringify({
        orderId,
        customerData: formData,
        cartItems: cart,
        totalPrice,
      }))

      // Создаём и отправляем форму POST на Robokassa с правильными параметрами
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = 'https://auth.robokassa.ru/Merchant/Index.aspx'
      form.style.display = 'none'
      
      // MerchantLogin
      const merchantInput = document.createElement('input')
      merchantInput.type = 'hidden'
      merchantInput.name = 'MerchantLogin'
      merchantInput.value = paymentData.merchantId
      form.appendChild(merchantInput)
      
      // OutSum
      const sumInput = document.createElement('input')
      sumInput.type = 'hidden'
      sumInput.name = 'OutSum'
      sumInput.value = paymentData.sum
      form.appendChild(sumInput)
      
      // InvId
      const invIdInput = document.createElement('input')
      invIdInput.type = 'hidden'
      invIdInput.name = 'InvId'
      invIdInput.value = paymentData.orderId
      form.appendChild(invIdInput)
      
      // Description
      const descInput = document.createElement('input')
      descInput.type = 'hidden'
      descInput.name = 'Description'
      descInput.value = paymentData.description
      form.appendChild(descInput)
      
      // SignatureValue
      const signInput = document.createElement('input')
      signInput.type = 'hidden'
      signInput.name = 'SignatureValue'
      signInput.value = paymentData.signature
      form.appendChild(signInput)
      
      // Email (optional)
      if (paymentData.customerEmail) {
        const emailInput = document.createElement('input')
        emailInput.type = 'hidden'
        emailInput.name = 'Email'
        emailInput.value = paymentData.customerEmail
        form.appendChild(emailInput)
      }
      
      console.log('📤 Отправка формы на Robokassa:', {
        MerchantLogin: paymentData.merchantId,
        OutSum: paymentData.sum,
        InvId: paymentData.orderId,
        SignatureValue: paymentData.signature
      })
      
      document.body.appendChild(form)
      form.submit()
    } catch (err) {
      console.error('Ошибка оформления заказа:', err)
      setError(err.message || 'Ошибка при оформлении заказа')
    } finally {
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
                  onClick={() => setShowCheckout(false)}
                  className="btn-secondary"
                >
                  Вернуться в корзину
                </button>
              </form>
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
        <h1>Корзина</h1>

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