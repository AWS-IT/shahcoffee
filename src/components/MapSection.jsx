// src/components/MapSection.jsx
import React from 'react';

const MapSection = () => {
  return (
    <section className="map-section" id="map">
      <div className="container">
        {/* Красивый заголовок */}
        <div className="section-title">
          <h2></h2>
        </div>

        {/* Сама карта */}
        <div className="map-wrapper">
          <iframe
            title="Наши точки на карте России"
            src="https://yandex.ru/map-widget/v1/?um=constructor%3A71d9e8a56a7855d5d7b0c0ecff6cc7a68816756288df45e33a1f4c5760ad48a1&amp;source=constructor&amp;lang=ru_RU"
            width="100%"
            height="560"
            frameBorder="0"
            allowFullScreen
            loading="lazy"
          ></iframe>

          {/* Опционально: красивый оверлей с иконкой (можно убрать, если не нужен) 
          <div className="map-overlay">
            <div className="map-pin">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                  fill="#3bc9c1"
                />
                <circle cx="12" cy="9" r="2.5" fill="white" />
              </svg>
            </div>
            <p>Более 1500 точек</p>
          </div>*/}
        </div>
      </div>
    </section>
  );
};

export default MapSection;