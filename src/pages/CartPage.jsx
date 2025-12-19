// src/pages/CartPage.jsx
import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import CheckoutForm from '../components/CheckoutForm.jsx'

export default function CartPage() {
  const { cart, updateQuantity, removeFromCart, clearCart, totalPrice } = useCart()
  const navigate = useNavigate()
  const [showCheckoutForm, setShowCheckoutForm] = useState(false)

  const handleCheckout = async (formData) => {
    try {
      // Отправляем данные заказа на сервер
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer: {
            name: formData.name,
            phone: formData.phone,
            address: formData.address,
            comment: formData.comment
          },
          items: cart,
          totalPrice: totalPrice
        })
      })

      if (!response.ok) {
        throw new Error('Ошибка при создании заказа')
      }

      const result = await response.json()
      
      // Очищаем корзину и закрываем форму
      clearCart()
      setShowCheckoutForm(false)
      
      // Показываем сообщение об успехе
      alert(`Заказ ${result.orderNumber} успешно создан!`)
      navigate('/catalog')
    } catch (error) {
      console.error('Ошибка:', error)
      throw error
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
            <button onClick={() => setShowCheckoutForm(true)} className="btn-primary btn-lg">
              Оформить заказ
            </button>

            <button onClick={clearCart} className="btn-secondary">
              Очистить корзину
            </button>
          </div>
        </div>

        {showCheckoutForm && (
          <CheckoutForm 
            totalPrice={totalPrice}
            cartItems={cart}
            onClose={() => setShowCheckoutForm(false)}
            onSubmit={handleCheckout}
          />
        )}
        
      </div>
    </section>
  )
}