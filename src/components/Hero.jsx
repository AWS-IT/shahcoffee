import React from 'react';

function Hero() {
  const scrollToContacts = () => {
    const element = document.getElementById('contacts');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToCatalog = () => {
    const element = document.getElementById('catalog');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="hero">
      <div className="container">
        <div className="hero__inner">
          <div className="hero__content">
            <h1 className="hero__title">
              Брендированные стаканчики, которые продают ваш кофе ещё до первого глотка
            </h1>
            {/*<p className="hero__subtitle">
              Создаём уникальные стаканчики с вашим логотипом и дизайном. Помогаем кофейням,
              пекарням и точкам to-go выделиться среди конкурентов и запомниться клиентам.
            </p>*/}
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
            <div className="hero__cup-mockup">
              <div className="hero__cup-label">
                <img src="src/public/main_photos/photomain.jpg" alt="photo" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;