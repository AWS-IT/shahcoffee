import React from 'react';

function About() {
  const features = [
    {
      id: 1,
      icon: 'Б',
      title: 'Быстрая печать',
      description: 'От макета до готовых стаканчиков — 5-7 дней',
    },
    {
      id: 2,
      icon: 'П',
      title: 'Помощь с дизайном',
      description: 'Бесплатная разработка макета под ваш бренд',
    },
    {
      id: 3,
      icon: 'Т',
      title: 'Тиражи',
      description: 'Работаем с заказами от 25000 штук',
    },
    {
      id: 4,
      icon: 'К',
      title: 'Качество',
      description: 'Экологичные материалы и стойкая печать',
    },
  ];

  return (
    <section id="about" className="section section--about">
      <div className="container">
        <h2 className="section__title">О нас</h2>
        <div className="about__content">
          <p className="about__text">
            ШАХ - специализируемся на производстве брендированной
            одноразовой посуды для бизнеса. Наши клиенты — это кофейни, пекарни, точки
            to-go и корнер-бары, которые хотят выделиться и создать узнаваемый образ.
          </p>
          <p className="about__text">
            Мы понимаем, как важен каждый элемент в продвижении вашего бренда. Стаканчик
            с вашим логотипом — это мобильная реклама, которую клиент носит с собой.
            Качественный дизайн и печать делают ваш бренд заметным и запоминающимся.
          </p>
        </div>

        <div className="about__features">
          {features.map((feature) => (
            <div key={feature.id} className="about__feature">
              <div className="about__feature-icon">{feature.icon}</div>
              <h3 className="about__feature-title">{feature.title}</h3>
              <p className="about__feature-description">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default About;