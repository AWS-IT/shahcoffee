import React, { useState, useEffect, useCallback } from 'react';

const SLIDES = [
  { src: '/main_photos/photomain.jpg', alt: 'ШАХ — брендированные стаканчики' },
  // Добавляй новые слайды сюда:
  { src: '/main_photos/promo2.jpg', alt: 'Промо 2' },
  { src: '/main_photos/promo3.jpg', alt: 'Промо 3' },
];

const AUTO_SCROLL_INTERVAL = 5000; // 5 секунд

function Hero() {
  const [current, setCurrent] = useState(0);
  const total = SLIDES.length;

  const next = useCallback(() => {
    setCurrent(prev => (prev + 1) % total);
  }, [total]);

  const prev = useCallback(() => {
    setCurrent(prev => (prev - 1 + total) % total);
  }, [total]);

  // Авто-прокрутка
  useEffect(() => {
    if (total <= 1) return;
    const timer = setInterval(next, AUTO_SCROLL_INTERVAL);
    return () => clearInterval(timer);
  }, [next, total]);

  const scrollToContacts = () => {
    document.getElementById('footer')?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToCatalog = () => {
    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="hero">
      <div className="container">
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
                <>
                  <button className="hero__slider-btn hero__slider-btn--prev" onClick={prev} aria-label="Назад">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <button className="hero__slider-btn hero__slider-btn--next" onClick={next} aria-label="Вперёд">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 6 15 12 9 18"/></svg>
                  </button>
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
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;