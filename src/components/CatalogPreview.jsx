import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function CatalogPreview() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api_ms/entity/product?expand=images', {
  method: 'GET'
})
      .then(r => r.json())
      .then(data => {
        console.log(data.rows[0]?.images) 
        setProducts(data.rows || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const loadProducts = async () => {
    try {
      const response = await fetch('/api/products')
      const data = await response.json()
      
      if (response.ok && data.rows) {
        setProducts(data.rows || [])
      } else {
        console.error('Ошибка загрузки товаров:', data)
      }
    } catch (error) {
      console.error('Ошибка загрузки товаров:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPrice = (product) => {
    const price = product.salePrices?.find(p => p.priceType?.name === 'Цена продажи')
    if (!price) return { main: 'По запросу' }
    const main = (price.value / 100).toLocaleString('ru-RU')
    const perUnit = product.name.toLowerCase().includes('1000') ? ((price.value / 100) / 1000).toFixed(2) : null
    return { main, perUnit }
  }

  const getImageUrl = (product) => {
    const img = product.images?.rows?.[0];
    if (img?.miniature?.downloadHref) return img.miniature.downloadHref;
    if (img?.tiny?.href) return img.tiny.href;
    if (img?.meta?.downloadHref) return img.meta.downloadHref;
    return null;
  };

  if (loading) return <div className="catalog-loading">Загрузка...</div>

  return (
    <div className="catalog" id="catalog">
      <div className="container">
        <h2 className="catalog__title">Каталог продукции</h2>
        <div className="catalog__grid">
          {products.map(product => {
            const price = getPrice(product)
            return (
              <Link to={`/product/${product.id}`} key={product.id} className="product-card-link">
                <article className="product-card">
                  <div className="product-card__image">
                    <img src={getImageUrl(product)} alt={product.name} loading="lazy" />
                  </div>
                  <div className="product-card__info">
                    <h3 className="product-card__name">{product.name}</h3>
                    <div className="product-card__price">
                      <span className="product-card__price-main">{price.main} ₽</span>
                      {price.perUnit && <span className="product-card__price-unit">{price.perUnit} ₽/шт</span>}
                    </div>
                  </div>
                </article>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}