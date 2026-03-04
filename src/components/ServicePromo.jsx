// src/components/ServicePromo.jsx
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function ServicePromo() {
  const [service, setService] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/hero-service')
        if (r.ok) {
          const data = await r.json()
          if (data.service) setService(data.service)
        }
      } catch (err) {
        console.error('Ошибка загрузки услуги:', err)
      }
    }
    load()
  }, [])

  if (!service) return null

  const imageUrl = service.images?.[0]
    ? `/api/ms-image?url=${encodeURIComponent(service.images[0])}`
    : null

  return (
    <section className="service-promo">
      <div className="container">
        <div className="service-promo__inner">
          {imageUrl && (
            <div className="service-promo__image">
              <img src={imageUrl} alt={service.name} loading="lazy" />
            </div>
          )}
          <div className="service-promo__content">
            <div className="service-promo__badge">Услуга</div>
            <h2 className="service-promo__title">{service.name}</h2>
            <p className="service-promo__desc">
              {service.description
                ? service.description.substring(0, 200) + (service.description.length > 200 ? '...' : '')
                : 'Разместите вашу рекламу на бумажных стаканчиках — эффективный и недорогой инструмент продвижения бренда'}
            </p>
            <div className="service-promo__price">
              {service.price.toLocaleString('ru-RU')} ₽
            </div>
            <Link to={`/service/${service.id}`} className="btn-primary service-promo__btn">
              Подробнее
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
