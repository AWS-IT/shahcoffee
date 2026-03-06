import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

const SLIDES = [
  { src: '/main_photos/photomain.jpg', alt: 'ШАХ — брендированные стаканчики' },
  { src: '/main_photos/promo2.jpg', alt: 'Промо 2' },
  { src: '/main_photos/promo3.jpg', alt: 'Промо 3' },
  { src: '/main_photos/promo4.jpg', alt: 'Промо 4' },
  { src: '/main_photos/promo5.jpg', alt: 'Промо 5' },
  { src: '/main_photos/promo6.jpg', alt: 'Промо 6' },
];

const AUTO_SCROLL_INTERVAL = 8000; // 8 секунд

function Hero() {
  const [current, setCurrent] = useState(0);
  const [service, setService] = useState(null);
  const total = SLIDES.length;

  const next = useCallback(() => {
    setCurrent(prev => (prev + 1) % total);
  }, [total]);

  // Авто-прокрутка
  useEffect(() => {
    if (total <= 1) return;
    const timer = setInterval(next, AUTO_SCROLL_INTERVAL);
    return () => clearInterval(timer);
  }, [next, total]);

  // Загрузка услуги для промо
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/hero-service');
        if (r.ok) {
          const data = await r.json();
          if (data.service) setService(data.service);
        }
      } catch (err) {
        console.error('Ошибка загрузки услуги:', err);
      }
    };
    load();
  }, []);

  const scrollToContacts = () => {
    document.getElementById('footer')?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToCatalog = () => {
    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="hero">
      <div className="container">
        {/* Промо-баннер услуги */}
        {service && (
          <Link to={`/service/${service.id}`} className="hero__service-banner">
            <span className="hero__service-badge">Услуга</span>
            <span className="hero__service-name">{service.name}</span>
            <span className="hero__service-price">{service.price.toLocaleString('ru-RU')} ₽</span>
            <span className="hero__service-arrow">→</span>
          </Link>
        )}

        <div className="hero__inner">
          <div className="hero__content">
            <h1 className="hero__title">
              Брендированные стаканчики, которые продают ваш кофе ещё до первого глотка
            </h1>
            <div className="hero__buttons">
              <button onClick={scrollToContacts} className="btn btn--primary">
                Оставить заявку
              </button>
              <button onClick={scrollToCatalog} className="btn btn--ghost">
                Смотреть каталог
              </button>
            </div>
          </div>

          <div className="hero__visual">
            <div className="hero__slider">
              <div
                className="hero__slider-track"
                style={{ transform: `translateX(-${current * 100}%)` }}
              >
                {SLIDES.map((slide, i) => (
                  <div className="hero__slide" key={i}>
                    <img src={slide.src} alt={slide.alt} loading={i === 0 ? 'eager' : 'lazy'} />
                  </div>
                ))}
              </div>

              {total > 1 && (
                <div className="hero__slider-dots">
                  {SLIDES.map((_, i) => (
                    <button
                      key={i}
                      className={`hero__slider-dot${i === current ? ' hero__slider-dot--active' : ''}`}
                      onClick={() => setCurrent(i)}
                      aria-label={`Слайд ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;