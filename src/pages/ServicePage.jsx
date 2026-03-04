// src/pages/ServicePage.jsx
import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'

export default function ServicePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [service, setService] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadService = async () => {
      try {
        const r = await fetch(`/api_ms/entity/service/${id}?expand=images`)
        if (r.ok) {
          const data = await r.json()
          setService(data)
        }
      } catch (err) {
        console.error('Ошибка загрузки услуги:', err)
      } finally {
        setLoading(false)
      }
    }
    loadService()
  }, [id])

  if (loading) return <div className="loading">Загрузка...</div>
  if (!service) return (
    <section className="service-page">
      <div className="container">
        <h1>Услуга не найдена</h1>
        <Link to="/" className="btn-primary">На главную</Link>
      </div>
    </section>
  )

  const priceEntry = service.salePrices?.find(p => p.priceType?.name === 'Цена продажи')
  const priceRub = priceEntry ? priceEntry.value / 100 : 0

  const getImageUrl = (img) => {
    const raw = img?.meta?.downloadHref || img?.miniature?.downloadHref || img?.tiny?.href || null
    return raw ? `/api/ms-image?url=${encodeURIComponent(raw)}` : null
  }
  const allImages = (service.images?.rows || []).map(img => getImageUrl(img)).filter(Boolean)
  const mainImage = allImages[0] || null

  return (
    <section className="service-page">
      <div className="container">
        <div className="breadcrumbs">
          <Link to="/">Главная</Link> → <span>{service.name}</span>
        </div>

        <div className="service-page__grid">
          {/* Левая колонка: изображение */}
          <div className="service-page__image-col">
            {mainImage ? (
              <div className="service-page__image-wrapper">
                <img src={mainImage} alt={service.name} />
              </div>
            ) : (
              <div className="service-page__image-placeholder">
                <span>📢</span>
              </div>
            )}
          </div>

          {/* Правая колонка: инфо */}
          <div className="service-page__info-col">
            <h1 className="service-page__title">{service.name}</h1>

            <div className="service-page__price-block">
              <span className="service-page__price">{priceRub.toLocaleString('ru-RU')} ₽</span>
            </div>

            <div className="service-page__features">
              <div className="service-page__feature">
                <span className="feature-icon">☕</span>
                <div>
                  <strong>Эффективная реклама</strong>
                  <p>Ваш бренд на каждом стаканчике кофе — тысячи показов ежедневно</p>
                </div>
              </div>
              <div className="service-page__feature">
                <span className="feature-icon">🎨</span>
                <div>
                  <strong>Индивидуальный дизайн</strong>
                  <p>Разработаем уникальный макет под ваш логотип и фирменный стиль</p>
                </div>
              </div>
              <div className="service-page__feature">
                <span className="feature-icon">📍</span>
                <div>
                  <strong>Целевая аудитория</strong>
                  <p>Реклама доходит до активных потребителей в кофейнях города</p>
                </div>
              </div>
              <div className="service-page__feature">
                <span className="feature-icon">📊</span>
                <div>
                  <strong>Прозрачная отчётность</strong>
                  <p>Предоставляем данные о количестве и точках распространения</p>
                </div>
              </div>
            </div>

            <button
              className="btn-primary btn-lg service-page__order-btn"
              onClick={() => navigate(`/service-checkout/${id}`)}
            >
              Заказать услугу
            </button>
          </div>
        </div>

        {/* Описание из МойСклад */}
        {service.description && (
          <div className="service-page__description">
            <h2>Подробнее об услуге</h2>
            <div dangerouslySetInnerHTML={{ __html: service.description.replace(/\n/g, '<br>') }} />
          </div>
        )}

        {/* Как это работает */}
        <div className="service-page__how-it-works">
          <h2>Как это работает</h2>
          <div className="service-page__steps">
            <div className="service-page__step">
              <div className="step-number">1</div>
              <h3>Оформляете заказ</h3>
              <p>Оплачиваете услугу через сайт — быстро и безопасно</p>
            </div>
            <div className="service-page__step">
              <div className="step-number">2</div>
              <h3>Согласуем дизайн</h3>
              <p>Наш дизайнер свяжется с вами для подготовки макета</p>
            </div>
            <div className="service-page__step">
              <div className="step-number">3</div>
              <h3>Производство</h3>
              <p>Печатаем стаканчики с вашей рекламой на современном оборудовании</p>
            </div>
            <div className="service-page__step">
              <div className="step-number">4</div>
              <h3>Распространение</h3>
              <p>Стаканчики появляются в кофейнях города — ваш бренд работает!</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
