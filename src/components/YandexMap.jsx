import React, { useEffect, useRef } from 'react';

export default function YandexMap({ address, orderData, lat, lon }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    // Проверяем, загружен ли уже API
    if (window.ymaps) {
      initMap();
      return;
    }

    // Загружаем Яндекс карту API
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
  }, [lat, lon]);

  const initMap = () => {
    if (!window.ymaps || !mapContainerRef.current) return;

    window.ymaps.ready(() => {
      if (mapRef.current) {
        mapRef.current.destroy();
      }

      const latitude = lat || 55.7558;
      const longitude = lon || 37.6173;

      const map = new window.ymaps.Map(mapContainerRef.current, {
        center: [latitude, longitude],
        zoom: 16,
        controls: ['zoomControl', 'fullscreenControl'],
      });

      mapRef.current = map;

      const placemark = new window.ymaps.Placemark(
        [latitude, longitude],
        {
          balloonContentHeader: '<strong>📦 Ваш заказ</strong>',
          balloonContentBody: `
            <div style="padding: 10px; font-family: Arial; font-size: 14px;">
              <p><strong>Адрес:</strong><br/>${address || 'Не указан'}</p>
              ${orderData ? `
                <p><strong>Получатель:</strong> ${orderData.customerData?.name || ''}</p>
                <p><strong>Сумма:</strong> ${orderData.totalPrice?.toLocaleString('ru-RU') || '0'} ₽</p>
              ` : ''}
            </div>
          `,
          iconCaption: 'Доставка',
        },
        {
          preset: 'islands#redDeliveryIcon',
        }
      );

      map.geoObjects.add(placemark);
      placemark.balloon.open();
    });
  };

  return (
    <div 
      ref={mapContainerRef} 
      style={{
        width: '100%',
        height: '400px',
        borderRadius: '16px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
        background: '#f0f0f0',
      }}
    />
  );
}
