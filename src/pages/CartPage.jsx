// src/pages/CartPage.jsx
import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'

// ВСТАВЬ СЮДА СВОЮ ОБЩЕДОСТУПНУЮ ССЫЛКУ ИЗ ПРИЛОЖЕНИЯ "ОНЛАЙН-ЗАКАЗ"
// Примеры:
// https://b2b.moysklad.ru/public/Nk4i8a8eOIMa/catalog
// https://online.moysklad.ru/app/#onlineorder?id=8a9f7e3d-1a2b-4c5d-9e8f-7g6h5i4j3k2l
const PUBLIC_CATALOG_URL = 'https://b2b.moysklad.ru/public/Nk4i8a8eOIMa/catalog'
// Если у тебя ссылка с #onlineorder — тоже подойдёт:
// const PUBLIC_CATALOG_URL = 'https://online.moysklad.ru/app/#onlineorder?id=abc123'

export default function CartPage() {
  const { cart, updateQuantity, removeFromCart, clearCart, totalPrice } = useCart()
  const navigate = useNavigate()

  const handleCheckout = () => {
    // Очищаем локальную корзину (чтобы не было дублей)
    clearCart()

    // Переходим в официальный публичный каталог МойСклада — без логина, без твоего ЛК
    window.location.href = PUBLIC_CATALOG_URL
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
            <button onClick={handleCheckout} className="btn-primary btn-lg">
              Оформить заказ в МойСклад
            </button>

            <button onClick={clearCart} className="btn-secondary">
              Очистить корзину
            </button>
          </div>

          <div className="cart-note">
            <p>
              После нажатия вы перейдёте в официальный каталог МойСклада.<br />
              Там можно изменить количество, добавить товары и завершить заказ.<br />
              <strong>Никакой регистрации не требуется.</strong>
            </p>
          </div>
        </div>
        
      </div>
    </section>
  )
}