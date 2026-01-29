import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function CatalogPage() {
  const [products, setProducts] = useState([])
  const [filteredProducts, setFilteredProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    const loadProducts = async () => {
      try {
        // Сначала получаем выбранный склад
        const settingsRes = await fetch('/api/settings/selected_store')
        const settingsData = await settingsRes.json()
        const storeId = settingsData.value
        
        // Формируем URL с фильтром по складу если он выбран
        let url = '/api_ms/entity/product?expand=images&limit=100'
        if (storeId) {
          // Используем assortment с фильтром по складу для получения товаров с остатками
          // stockMode=positiveOnly - только товары с положительным остатком
          url = `/api_ms/entity/assortment?expand=images&limit=100&stockStore=https://api.moysklad.ru/api/remap/1.2/entity/store/${storeId}&stockMode=positiveOnly`
        }
        
        const response = await fetch(url)
        const data = await response.json()
        
        console.log('📦 Товары загружены:', data.rows?.length)
        if (data.rows?.[0]) {
          console.log('1️⃣ Первый товар:', data.rows[0])
        }
        
        setProducts(data.rows || [])
        setFilteredProducts(data.rows || [])
      } catch (error) {
        console.error('Ошибка загрузки товаров:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadProducts()
  }, [])

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredProducts(products)
    } else {
      const lowerTerm = searchTerm.toLowerCase()
      const filtered = products.filter(product =>
        product.name.toLowerCase().includes(lowerTerm)
      )
      setFilteredProducts(filtered)
    }
  }, [searchTerm, products])

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

  // Получаем уникальные названия для автодополнения, но только если searchTerm не пустой
  const productNames = [...new Set(products.map(p => p.name))]
  const suggestions = searchTerm.length > 0 
    ? productNames.filter(name => name.toLowerCase().includes(searchTerm.toLowerCase()))
    : []

  if (loading) return <div className="catalog-loading">Загрузка...</div>

  return (
    <section className="catalog-page" style={{marginTop: '25px', paddingTop: '70px', minHeight: '87vh' }}>
      <div className="container" style={{ maxWidth: '1480px', margin: '0 auto' }}>
        <h2 className="catalog__title">Каталог продукции</h2>
        
        {/* Поиск с автодополнением */}
        <div className="catalog__search-wrapper">
          <div className="catalog__search">
            <input
              type="text"
              placeholder="Поиск по названию товара (например, САХАР)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 200)} // задержка, чтобы успеть кликнуть
              className="catalog__search-input"
            />
          </div>

          {/* Кастомные подсказки — показываются только если есть текст и фокус */}
          {searchTerm.length > 0 && isFocused && suggestions.length > 0 && (
            <ul className="catalog__suggestions">
              {suggestions.map((name, index) => (
                <li
                  key={index}
                  className="catalog__suggestion-item"
                  onMouseDown={() => setSearchTerm(name)} // MouseDown, чтобы сработало до onBlur
                >
                  {name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="catalog__grid">
          {filteredProducts.map(product => {
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
    </section>
  )
}