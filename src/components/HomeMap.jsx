import React, { useEffect, useRef, useState } from 'react';

export default function HomeMap() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [markers, setMarkers] = useState([]);
  const [pickupPoints, setPickupPoints] = useState([]);
  const [coffeeComment, setCoffeeComment] = useState('');
  const [ymapsReady, setYmapsReady] = useState(false);

  useEffect(() => {
    fetch('/api/markers')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setMarkers(data); })
      .catch(err => console.error('Ошибка загрузки меток:', err));

    fetch('/api/pickup-points')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setPickupPoints(data.filter(p => p.is_active !== false)); })
      .catch(err => console.error('Ошибка загрузки ПВЗ:', err));

    fetch('/api/settings/coffee_shops_comment')
      .then(res => res.json())
      .then(data => { if (data.value) setCoffeeComment(data.value); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (window.ymaps) {
      window.ymaps.ready(() => setYmapsReady(true));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://api-maps.yandex.ru/2.1/?apikey=1d46fbe3-00ac-4866-8b69-2ac7f1458a9c&lang=ru_RU';
    script.type = 'text/javascript';
    script.async = true;
    document.head.appendChild(script);

    script.onload = () => {
      window.ymaps.ready(() => setYmapsReady(true));
    };

    return () => {
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!ymapsReady || !mapContainerRef.current) return;
    
    if (!mapRef.current) {
      const allPoints = [
        ...markers.map(m => ({ lat: m.lat, lon: m.lon })),
        ...pickupPoints.map(p => ({ lat: p.lat, lon: p.lon })),
      ];
      const centerLat = allPoints[0]?.lat || 55.7558;
      const centerLon = allPoints[0]?.lon || 37.6173;

      const map = new window.ymaps.Map(mapContainerRef.current, {
        center: [parseFloat(centerLat), parseFloat(centerLon)],
        zoom: 12,
        controls: ['zoomControl', 'fullscreenControl', 'geolocationControl'],
      });

      mapRef.current = map;
    }
    
    addAllMarkers();
  }, [ymapsReady, markers, pickupPoints]);

  const addAllMarkers = () => {
    if (!mapRef.current || !window.ymaps) return;

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
      const photoHtml = marker.photo_url
        ? '<img src="' + marker.photo_url + '" alt="' + marker.title + '" style="width:100%;max-height:160px;object-fit:cover;border-radius:8px;margin-bottom:8px;" />'
        : '';
      const infoHtml = marker.info
        ? '<p style="margin:6px 0 0;font-size:13px;color:#555;">' + marker.info + '</p>'
        : '';

      const bodyParts = [];
      if (photoHtml) bodyParts.push(photoHtml);
      if (marker.description) bodyParts.push('<p style="margin:0 0 8px;color:#333;">' + marker.description + '</p>');
      if (marker.address) bodyParts.push('<p style="margin:0 0 4px;color:#666;font-size:12px;">' + marker.address + '</p>');
      if (infoHtml) bodyParts.push(infoHtml);

      const placemark = new window.ymaps.Placemark(
        [parseFloat(marker.lat), parseFloat(marker.lon)],
        {
          balloonContentHeader: '<strong>' + marker.title + '</strong>',
          balloonContentBody: '<div style="padding:8px;font-family:Arial;font-size:14px;max-width:260px;">' + bodyParts.join('') + '</div>',
          hintContent: marker.title,
        },
        {
          preset: colorMap[marker.icon_color] || 'islands#redIcon',
          balloonPanelMaxMapArea: 0,
        }
      );

      mapRef.current.geoObjects.add(placemark);
    });

    pickupPoints.forEach(point => {
      if (!point.lat || !point.lon) return;

      const bodyParts = [];
      if (point.photo_url) {
        bodyParts.push('<img src="' + point.photo_url + '" alt="' + point.name + '" style="width:100%;max-height:160px;object-fit:cover;border-radius:8px;margin-bottom:8px;" />');
      }
      if (point.address) bodyParts.push('<p style="margin:0 0 6px;color:#666;font-size:12px;">' + point.address + '</p>');
      if (point.description) bodyParts.push('<p style="margin:0 0 6px;color:#333;">' + point.description + '</p>');
      if (point.working_hours) bodyParts.push('<p style="margin:0;color:#555;font-size:12px;">' + point.working_hours + '</p>');
      bodyParts.push('<p style="margin:6px 0 0;color:#2a7d2e;font-weight:600;font-size:13px;">Пункт выдачи</p>');

      const placemark = new window.ymaps.Placemark(
        [parseFloat(point.lat), parseFloat(point.lon)],
        {
          balloonContentHeader: '<strong>' + point.name + '</strong>',
          balloonContentBody: '<div style="padding:8px;font-family:Arial;font-size:14px;max-width:260px;">' + bodyParts.join('') + '</div>',
          hintContent: point.name,
        },
        {
          preset: 'islands#greenIcon',
          balloonPanelMaxMapArea: 0,
        }
      );

      mapRef.current.geoObjects.add(placemark);
    });

    const totalObjects = markers.length + pickupPoints.filter(p => p.lat && p.lon).length;
    if (totalObjects > 0) {
      mapRef.current.setBounds(mapRef.current.geoObjects.getBounds(), {
        checkZoomRange: true,
        zoomMargin: 50,
      });
    }
  };

  const redCount = markers.filter(m => m.icon_color === 'red' || !m.icon_color).length;
  const greenCount = pickupPoints.filter(p => p.lat && p.lon).length;

  return (
    <section className="home-map-section" id="dvs">
      <div className="container">
        <h2 className="section-title">Карта продаж</h2>
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

        <div className="map-stats">
          <div className="map-stats__item map-stats__item--green">
            <span className="map-stats__dot map-stats__dot--green"></span>
            <div>
              <span className="map-stats__label">Пункты выдачи</span>
              <span className="map-stats__count">{greenCount}</span>
            </div>
          </div>
          <div className="map-stats__item map-stats__item--red">
            <span className="map-stats__dot map-stats__dot--red"></span>
            <div>
              <span className="map-stats__label">Кофейни</span>
              <span className="map-stats__count">{redCount}</span>
              {coffeeComment && (
                <span className="map-stats__comment">{coffeeComment}</span>
              )}
            </div>
          </div>
        </div>
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
        .map-stats {
          display: flex;
          justify-content: center;
          gap: 32px;
          margin-top: 24px;
          flex-wrap: wrap;
        }
        .map-stats__item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          background: #fff;
          border-radius: 14px;
          padding: 16px 24px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          min-width: 180px;
        }
        .map-stats__dot {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          flex-shrink: 0;
          margin-top: 4px;
        }
        .map-stats__dot--green { background: #34a853; }
        .map-stats__dot--red { background: #e31937; }
        .map-stats__item > div {
          display: flex;
          flex-direction: column;
        }
        .map-stats__label {
          font-size: 14px;
          color: #666;
          font-weight: 500;
        }
        .map-stats__count {
          font-size: 26px;
          font-weight: 800;
          color: #1a1a2e;
          line-height: 1.2;
        }
        .map-stats__comment {
          font-size: 13px;
          color: #888;
          margin-top: 2px;
        }
      `}</style>
    </section>
  );
}
