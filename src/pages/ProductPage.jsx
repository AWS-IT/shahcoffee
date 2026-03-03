// src/pages/ProductPage.jsx
import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'

export default function ProductPage() {
  const { id } = useParams()
  const [product, setProduct] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [activeImage, setActiveImage] = useState(0)
  const { addToCart } = useCart()

  useEffect(() => {
    const loadProduct = async () => {
      // Пробуем загрузить как товар, если 404 — как услугу
      for (const entity of ['product', 'service']) {
        try {
          const r = await fetch(`/api_ms/entity/${entity}/${id}?expand=images`);
          if (r.ok) {
            const data = await r.json();
            setProduct(data);
            setActiveImage(0);
            return;
          }
        } catch (err) {
          console.error(`Ошибка загрузки ${entity}:`, err);
        }
      }
      setProduct(null);
    };
    loadProduct();
  }, [id])

  if (!product) return <div className="loading">Загрузка...</div>

  const priceEntry = product.salePrices?.find(p => p.priceType?.name === 'Цена продажи')
  const priceRub = priceEntry ? priceEntry.value / 100 : 0
  const totalPrice = priceRub * quantity

  // Все изображения товара
  const getImageUrl = (img) => {
    const raw = img?.meta?.downloadHref || img?.miniature?.downloadHref || img?.tiny?.href || null;
    return raw ? `/api/ms-image?url=${encodeURIComponent(raw)}` : null;
  };

  const allImages = (product.images?.rows || []).map(img => getImageUrl(img)).filter(Boolean);
  const mainImageUrl = allImages[activeImage] || allImages[0] || null;

  const waText = encodeURIComponent(
    `Заказ с сайта ШАХ:\n${product.name}\nКоличество: ${quantity} уп.\nСумма: ${totalPrice.toLocaleString('ru-RU')} ₽\nАртикул: ${product.code || '-'}\n\nПрошу выставить счёт`
  )

  const handleAddToCart = () => {
    addToCart({
      id: product.id,
      name: product.name,
      code: product.code || null,
      priceRub,
      image: allImages[0] || null
    }, quantity)
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
              <img
                src={mainImageUrl}
                alt={product.name}
                className="product-page__main-image"
                loading="lazy"
              />
            </div>

            {/* Миниатюры — показываем если >1 фото */}
            {allImages.length > 1 && (
              <div className="product-page__thumbs">
                {allImages.map((url, i) => (
                  <button
                    key={i}
                    className={`product-page__thumb${i === activeImage ? ' product-page__thumb--active' : ''}`}
                    onClick={() => setActiveImage(i)}
                  >
                    <img src={url} alt={`${product.name} — фото ${i + 1}`} loading="lazy" />
                  </button>
                ))}
              </div>
            )}

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