// src/pages/ProductPage.jsx
import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'

export default function ProductPage() {
  const { id } = useParams()
  const [product, setProduct] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const { addToCart } = useCart()

  useEffect(() => {
    fetch(`/api_ms/entity/product/${id}?expand=images`)
      .then(r => {
        if (!r.ok) throw new Error('Товар не найден')
        return r.json()
      })
      .then(setProduct)
      .catch(err => {
        console.error(err)
        setProduct(null)
      })
  }, [id])

  if (!product) return <div className="loading">Загрузка...</div>

  const priceEntry = product.salePrices?.find(p => p.priceType?.name === 'Цена продажи')
  const priceRub = priceEntry ? priceEntry.value / 100 : 0
  const totalPrice = priceRub * quantity

  // Правильное извлечение изображения
  const getMainImage = () => {
    const rows = product.images?.rows
    if (rows && rows.length > 0) {
      const img = rows[0]
      return img.miniature?.downloadHref || img.tiny?.href || img.meta?.downloadHref || null
    }
    return null
  }

  const imageUrl = getMainImage();

  const waText = encodeURIComponent(
    `Заказ с сайта ШАХ:\n${product.name}\nКоличество: ${quantity} уп.\nСумма: ${totalPrice.toLocaleString('ru-RU')} ₽\nАртикул: ${product.code || '-'}\n\nПрошу выставить счёт`
  )

  const handleAddToCart = () => {
    addToCart({
      id: product.id,
      name: product.name,
      code: product.code || null,
      priceRub,
      image: imageUrl // теперь точно будет нормальная ссылка
    }, quantity)
    alert('Добавлено в корзину!')
  }

  return (
    <section className="product-page">
      <div className="container">
        <div className="breadcrumbs">
          <Link to="/">Главная</Link> → <Link to="/catalog">Каталог</Link> → <span>{product.name}</span>
        </div>

        <div className="product-page__grid">
          {/* Левая колонка: фото + покупка */}
          <div className="product-page__main">
            <div className="product-page__gallery">
              <img src={imageUrl} alt={product.name} className="product-page__main-image" loading="lazy" />
            </div>

            <div className="product-page__buybox">
              <div className="product-page__price">
                <span className="price-current">{priceRub.toLocaleString('ru-RU')} ₽</span>
                <span className="price-unit">/ упаковка</span>
              </div>

              {product.code && (
                <p className="product-page__code">
                  <strong>Артикул:</strong> {product.code}
                </p>
              )}

              <div className="quantity-block">
                <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="qty-btn">−</button>
                <span className="qty-value">{quantity}</span>
                <button onClick={() => setQuantity(q => q + 1)} className="qty-btn">+</button>
              </div>

              <div className="total-price-block">
                Итого: <strong>{totalPrice.toLocaleString('ru-RU')} ₽</strong>
              </div>

              <div className="product-page__actions">
                <button onClick={handleAddToCart} className="btn-primary">
                  В корзину
                </button>
                <a
                  href={`https://wa.me/79991234567?text=${waText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-whatsapp"
                >
                  Заказать в WhatsApp
                </a>
              </div>
            </div>
          </div>

          {/* Правая колонка: только описание */}
          {product.description && (
            <div className="product-page__description-section">
              <h3 className="description-title">Описание товара</h3>
              <div className="description-text" dangerouslySetInnerHTML={{ __html: product.description.replace(/\n/g, '<br>') }} />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}