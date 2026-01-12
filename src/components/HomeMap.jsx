import React, { useEffect, useRef, useState } from 'react';

export default function HomeMap() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [markers, setMarkers] = useState([]);

  // Загружаем метки с сервера
  useEffect(() => {
    fetch('/api/markers')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setMarkers(data);
        }
      })
      .catch(err => console.error('Ошибка загрузки меток:', err));
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Проверяем, загружен ли уже API
    if (window.ymaps) {
      initMap();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://api-maps.yandex.ru/2.1/?apikey=1d46fbe3-00ac-4866-8b69-2ac7f1458a9c&lang=ru_RU';
    script.type = 'text/javascript';
    script.async = true;
    document.head.appendChild(script);

    script.onload = () => initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, []);

  // Обновляем метки на карте при изменении данных
  useEffect(() => {
    if (mapRef.current && markers.length > 0) {
      addMarkersToMap();
    }
  }, [markers]);

  const initMap = () => {
    if (!window.ymaps || !mapContainerRef.current) return;

    window.ymaps.ready(() => {
      if (mapRef.current) {
        mapRef.current.destroy();
      }

      // Центр карты - Москва или первая метка
      const centerLat = markers[0]?.lat || 55.7558;
      const centerLon = markers[0]?.lon || 37.6173;

      const map = new window.ymaps.Map(mapContainerRef.current, {
        center: [centerLat, centerLon],
        zoom: 12,
        controls: ['zoomControl', 'fullscreenControl', 'geolocationControl'],
      });

      mapRef.current = map;
      
      if (markers.length > 0) {
        addMarkersToMap();
      }
    });
  };

  const addMarkersToMap = () => {
    if (!mapRef.current || !window.ymaps) return;

    // Очищаем старые метки
    mapRef.current.geoObjects.removeAll();

    const colorMap = {
      red: 'islands#redIcon',
      blue: 'islands#blueIcon',
      green: 'islands#greenIcon',
      orange: 'islands#orangeIcon',
      violet: 'islands#violetIcon',
      yellow: 'islands#yellowIcon',
    };

    markers.forEach(marker => {
      const placemark = new window.ymaps.Placemark(
        [parseFloat(marker.lat), parseFloat(marker.lon)],
        {
          balloonContentHeader: `<strong>${marker.title}</strong>`,
          balloonContentBody: `
            <div style="padding: 10px; font-family: Arial; font-size: 14px; max-width: 250px;">
              ${marker.description ? `<p style="margin: 0 0 10px 0; color: #333;">${marker.description}</p>` : ''}
              ${marker.address ? `<p style="margin: 0; color: #666; font-size: 12px;">📍 ${marker.address}</p>` : ''}
            </div>
          `,
          hintContent: marker.title,
        },
        {
          preset: colorMap[marker.icon_color] || 'islands#redIcon',
          balloonPanelMaxMapArea: 0,
        }
      );

      mapRef.current.geoObjects.add(placemark);
    });

    // Если есть метки, центрируем карту на них
    if (markers.length > 0) {
      mapRef.current.setBounds(mapRef.current.geoObjects.getBounds(), {
        checkZoomRange: true,
        zoomMargin: 50,
      });
    }
  };

  return (
    <section className="home-map-section" id="dvs">
      <div className="container">
        <h2 className="section-title">🗺️ Карта продаж</h2>
        <p className="section-subtitle">Наши точки и места доставки</p>
        
        <div 
          ref={mapContainerRef} 
          style={{
            width: '100%',
            height: '500px',
            borderRadius: '20px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
            background: '#f0f0f0',
          }}
        />
      </div>

      <style>{`
        .home-map-section {
          padding: 80px 0;
          background: linear-gradient(180deg, #fff 0%, #f6f1e9 100%);
        }

        .home-map-section .section-title {
          font-size: 40px;
          text-align: center;
          margin-bottom: 10px;
          color: #2b2620;
        }

        .home-map-section .section-subtitle {
          text-align: center;
          color: #8a7b6a;
          font-size: 16px;
          margin-bottom: 40px;
        }
      `}</style>
    </section>
  );
}
