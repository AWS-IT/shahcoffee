import React, { useState } from 'react'
import '../styles/checkout-form.css'

export default function CheckoutForm({ totalPrice, cartItems, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    comment: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Валидация
    if (!formData.name.trim()) {
      setError('Укажите имя')
      return
    }
    if (!formData.phone.trim()) {
      setError('Укажите телефон')
      return
    }
    if (!formData.address.trim()) {
      setError('Укажите адрес')
      return
    }

    setLoading(true)
    setError('')

    try {
      await onSubmit(formData)
    } catch (err) {
      setError(err.message || 'Ошибка при создании заказа')
      setLoading(false)
    }
  }

  return (
    <div className="checkout-modal-overlay" onClick={onClose}>
      <div className="checkout-modal" onClick={e => e.stopPropagation()}>
        <button className="checkout-close" onClick={onClose}>✕</button>
        
        <h2>Оформление заказа</h2>
        
        <form onSubmit={handleSubmit} className="checkout-form">
          <div className="form-group">
            <label htmlFor="name">Имя *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Ваше имя"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Телефон *</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+7 (999) 999-99-99"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="address">Адрес *</label>
            <input
              type="text"
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Город, улица, дом, квартира"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="comment">Комментарий (необязательно)</label>
            <textarea
              id="comment"
              name="comment"
              value={formData.comment}
              onChange={handleChange}
              placeholder="Ваши пожелания или примечания"
              rows="4"
              disabled={loading}
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="checkout-summary">
            <div className="summary-items">
              <h3>Товары в заказе:</h3>
              <ul>
                {cartItems.map(item => (
                  <li key={item.id}>
                    {item.name} x{item.quantity} = {(item.priceRub * item.quantity).toLocaleString('ru-RU')} ₽
                  </li>
                ))}
              </ul>
            </div>
            <div className="summary-total">
              <strong>Итого: {totalPrice.toLocaleString('ru-RU')} ₽</strong>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-primary btn-submit"
            disabled={loading}
          >
            {loading ? 'Создание заказа...' : 'Создать заказ'}
          </button>
        </form>
      </div>
    </div>
  )
}
