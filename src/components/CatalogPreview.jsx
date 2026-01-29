import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function CatalogPreview() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadProducts = async () => {
      try {
        // Фильтруем только товары из группы "ШАХ ШОП" через assortment
        const SHAHSHOP_FOLDER_ID = 'b83c3cac-cc16-11f0-0a80-0ea000180ae3'
        const folderUrl = `https://api.moysklad.ru/api/remap/1.2/entity/productfolder/${SHAHSHOP_FOLDER_ID}`
        const url = `/api_ms/entity/assortment?expand=images&limit=100&filter=productFolder=${encodeURIComponent(folderUrl)}`
        
        const response = await fetch(url)
        const data = await response.json()
        
        console.log('📦 Товары ШАХ ШОП загружены:', data.rows?.length)
        setProducts(data.rows || [])
      } catch (error) {
        console.error('Ошибка загрузки товаров:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadProducts()
  }, [])

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

  const previewProducts = products.slice(0, 8) /* здесь products на previewProducts поменял чтоб поставить ограничение*/

return (
    <div className="catalog" id="catalog">
      <div className="container">
        <h2 className="catalog__title">Наша продукция</h2>
        <div className="catalog__grid">
          {previewProducts.map(product => {       
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
        {/* Кнопка на полную страницу, если товаров больше 8 */}
        {products.length >= 8 && (
          <div className="catalog__toggle">
            <Link to="/catalog" className="catalog__toggle-btn">
              Посмотреть еще
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}