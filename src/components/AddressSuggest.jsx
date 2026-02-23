import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';

function normalizeForMatch(s) {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export default function AddressSuggest({ value, onChange, onSelect, placeholder = 'Введите адрес доставки', pickupPoints = [] }) {
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCoords, setManualCoords] = useState({ lat: '', lon: '' });
  const inputRef = useRef(null);
  const suggestRef = useRef(null);
  const debounceRef = useRef(null);

  // Пункты выдачи, подходящие по введённому адресу (фильтр по name и address)
  const filteredPickupPoints = useMemo(() => {
    const query = normalizeForMatch(value);
    if (!query || query.length < 2) return pickupPoints;
    return pickupPoints.filter((point) => {
      const name = normalizeForMatch(point.name);
      const address = normalizeForMatch(point.address);
      return name.includes(query) || address.includes(query);
    });
  }, [pickupPoints, value]);

  // Поиск адресов через Nominatim (OpenStreetMap) - бесплатно и без ключа
  const searchAddress = useCallback(async (query) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);

    try {
      // Используем наш прокси-сервер вместо прямого обращения к Nominatim
      // Это решает проблему CORS и добавляет User-Agent
      const response = await fetch(
        `/api/address-search?q=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error('Ошибка запроса');
      }

      const data = await response.json();
      
      const items = data.map((item) => ({
        address: item.display_name,
        name: item.name || item.display_name.split(',')[0],
        description: item.display_name.split(',').slice(1).join(',').trim(),
        coordinates: {
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
        },
      }));

      console.log('Найдено адресов:', items.length, items);
      setSuggestions(items);
      setIsOpen(items.length > 0);
    } catch (error) {
      console.error('Ошибка поиска адреса:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounce для поиска
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchAddress(newValue);
    }, 300);
  };

  // Извлечь номер дома из строки (например "Чехова 21" -> "21")
  const extractHouseNumber = (text) => {
    const match = text.match(/\s(\d+[а-яА-Яa-zA-Z]?(?:\/\d+)?)\s*$/);
    return match ? match[1] : null;
  };

  // Выбор адреса из списка (подсказка или пункт выдачи)
  const handleSelectAddress = (suggestion) => {
    // Пункт выдачи уже приходит с address и coordinates
    if (suggestion.source === 'pickup') {
      onChange(suggestion.address);
      onSelect && onSelect({ address: suggestion.address, coordinates: suggestion.coordinates, source: 'pickup', id: suggestion.id });
      setIsOpen(false);
      setSuggestions([]);
      setShowManualInput(false);
      return;
    }
    // Подсказка по адресу: попробуем добавить номер дома, если он был в запросе
    const houseNumber = extractHouseNumber(value);
    let finalAddress = suggestion.address;
    if (houseNumber && !suggestion.address.match(/\d+[а-яА-Яa-zA-Z]?(?:\/\d+)?/)) {
      finalAddress = `${suggestion.name} ${houseNumber}, ${suggestion.description}`;
    }
    onChange(finalAddress);
    onSelect && onSelect({ ...suggestion, address: finalAddress });
    setIsOpen(false);
    setSuggestions([]);
    setShowManualInput(false);
  };

  // Запасные координаты для пунктов выдачи default-* (если с сервера пришли без координат)
  const DEFAULT_POINT_COORDS = {
    'default-1': { lat: 43.131677, lon: 45.537147 },
    'default-2': { lat: 55.873637, lon: 37.711949 },
    'default-3': { lat: 43.323797, lon: 45.694496 },
  };

  // Выбор пункта выдачи из списка (если нет координат — геокодер или запас для default-*)
  const handleSelectPickupPoint = async (point) => {
    let lat = point.lat;
    let lon = point.lon;
    const address = point.address || point.name;
    if (lat == null || lon == null) {
      const fallback = point.id && DEFAULT_POINT_COORDS[point.id];
      if (fallback) {
        lat = fallback.lat;
        lon = fallback.lon;
      } else if (address) {
        try {
          const res = await fetch(`/api/geocode?query=${encodeURIComponent(address)}`);
          if (res.ok) {
            const data = await res.json();
            const first = data.results && data.results[0];
            if (first?.coordinates) {
              lat = first.coordinates.lat;
              lon = first.coordinates.lon;
            }
          }
        } catch (e) {
          console.warn('Геокодер для пункта выдачи:', e);
        }
      }
      if (lat == null || lon == null) {
        alert('Не удалось определить координаты для этого пункта. Введите адрес вручную или выберите другой пункт.');
        return;
      }
    }
    handleSelectAddress({
      address: address || point.name,
      coordinates: { lat, lon },
      source: 'pickup',
      id: point.id,
    });
  };

  // Применить координаты вручную
  const handleManualCoords = () => {
    const lat = parseFloat(manualCoords.lat);
    const lon = parseFloat(manualCoords.lon);
    
    if (isNaN(lat) || isNaN(lon)) {
      alert('Введите корректные координаты');
      return;
    }
    
    const suggestion = {
      address: value || `Координаты: ${lat}, ${lon}`,
      name: value || 'Точка на карте',
      description: `Координаты: ${lat}, ${lon}`,
      coordinates: { lat, lon },
      source: 'manual',
    };
    
    handleSelectAddress(suggestion);
    setManualCoords({ lat: '', lon: '' });
  };

  // Открыть Яндекс Карты для выбора координат
  const openYandexMaps = () => {
    // Центр - примерно Урус-Мартан
    const defaultLat = 43.13;
    const defaultLon = 45.52;
    const url = `https://yandex.ru/maps/?ll=${defaultLon},${defaultLat}&z=14&whatshere[point]=${defaultLon},${defaultLat}&whatshere[zoom]=17`;
    window.open(url, '_blank');
  };

  // Закрытие при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        suggestRef.current &&
        !suggestRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="address-suggest">
      <div className="address-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
            if (filteredPickupPoints?.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="address-input"
          autoComplete="off"
        />
        {isLoading && <span className="address-loading">🔍</span>}
      </div>

      {isOpen && (suggestions.length > 0 || (filteredPickupPoints?.length > 0)) && (
        <ul ref={suggestRef} className="address-suggestions">
          {filteredPickupPoints?.length > 0 && (
            <>
              <li className="address-suggest-section-label">Пункты выдачи</li>
              {filteredPickupPoints.map((point) => (
                <li
                  key={point.id}
                  className="address-suggestion-item address-suggestion-pickup"
                  onClick={() => handleSelectPickupPoint(point)}
                >
                  <span className="suggestion-icon">🏪</span>
                  <div className="suggestion-content">
                    <span className="suggestion-name">{point.name}</span>
                    {(point.address || point.working_hours) && (
                      <span className="suggestion-description">
                        {point.address}
                        {point.address && point.working_hours ? ' · ' : ''}
                        {point.working_hours}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </>
          )}
          {suggestions.length > 0 && (
            <>
              {filteredPickupPoints?.length > 0 && <li className="address-suggest-section-label">Подсказки по адресу</li>}
              {suggestions.map((suggestion, index) => (
                <li
                  key={index}
                  className="address-suggestion-item"
                  onClick={() => handleSelectAddress(suggestion)}
                >
                  <span className="suggestion-icon">📍</span>
                  <div className="suggestion-content">
                    <span className="suggestion-name">{suggestion.name}</span>
                    {suggestion.description && (
                      <span className="suggestion-description">{suggestion.description}</span>
                    )}
                  </div>
                </li>
              ))}
            </>
          )}
        </ul>
      )}

      {/* Кнопка для ручного ввода координат */}
      <div className="address-manual-section">
        <button
          type="button"
          className="manual-coords-toggle"
          onClick={() => setShowManualInput(!showManualInput)}
        >
          {showManualInput ? '✕ Скрыть' : '📌 Не нашли адрес? Укажите координаты'}
        </button>
        
        {showManualInput && (
          <div className="manual-coords-form">
            <p className="manual-hint">
              Откройте <button type="button" className="link-button" onClick={openYandexMaps}>Яндекс Карты</button>, 
              найдите нужное место, нажмите на точку и скопируйте координаты.
            </p>
            <div className="coords-inputs">
              <input
                type="text"
                placeholder="Широта (lat), напр. 43.1315"
                value={manualCoords.lat}
                onChange={(e) => setManualCoords(prev => ({ ...prev, lat: e.target.value }))}
                className="coord-input"
              />
              <input
                type="text"
                placeholder="Долгота (lon), напр. 45.5273"
                value={manualCoords.lon}
                onChange={(e) => setManualCoords(prev => ({ ...prev, lon: e.target.value }))}
                className="coord-input"
              />
            </div>
            <button
              type="button"
              className="apply-coords-btn"
              onClick={handleManualCoords}
            >
              ✓ Применить координаты
            </button>
          </div>
        )}
      </div>

      <style>{`
        .address-suggest {
          position: relative;
          width: 100%;
        }

        .address-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .address-input {
          width: 100%;
          padding: 14px 16px;
          padding-right: 40px;
          border: 2px solid #e0e0e0;
          border-radius: 12px;
          font-size: 16px;
          transition: all 0.3s ease;
          background: white;
        }

        .address-input:focus {
          outline: none;
          border-color: #008B9D;
          box-shadow: 0 0 0 3px rgba(0, 139, 157, 0.1);
        }

        .address-loading {
          position: absolute;
          right: 14px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .address-suggestions {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
          margin-top: 4px;
          max-height: 280px;
          overflow-y: auto;
          z-index: 1000;
          list-style: none;
          padding: 8px 0;
        }

        .address-suggestion-item {
          display: flex;
          align-items: flex-start;
          padding: 12px 16px;
          cursor: pointer;
          transition: background 0.2s ease;
          gap: 12px;
        }

        .address-suggestion-item:hover {
          background: #f6f1e9;
        }

        .address-suggest-section-label {
          padding: 8px 16px 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #8a7b6a;
          cursor: default;
          list-style: none;
        }

        .address-suggestion-pickup .suggestion-icon {
          font-size: 16px;
        }

        .suggestion-icon {
          font-size: 18px;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .suggestion-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .suggestion-name {
          font-weight: 600;
          color: #2b2620;
          font-size: 14px;
        }

        .suggestion-description {
          font-size: 12px;
          color: #8a7b6a;
        }

        @media (max-width: 768px) {
          .address-input {
            font-size: 16px;
            padding: 12px 14px;
          }

          .address-suggestions {
            max-height: 200px;
          }

          .address-suggestion-item {
            padding: 10px 14px;
          }
        }

        /* Секция ручного ввода координат */
        .address-manual-section {
          margin-top: 12px;
        }

        .manual-coords-toggle {
          background: none;
          border: none;
          color: #008B9D;
          font-size: 13px;
          cursor: pointer;
          padding: 4px 0;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .manual-coords-toggle:hover {
          color: #006d7a;
        }

        .manual-coords-form {
          margin-top: 12px;
          padding: 16px;
          background: #f8f8f8;
          border-radius: 12px;
          border: 1px solid #e0e0e0;
        }

        .manual-hint {
          font-size: 13px;
          color: #666;
          margin: 0 0 12px 0;
          line-height: 1.5;
        }

        .link-button {
          background: none;
          border: none;
          color: #008B9D;
          font-size: 13px;
          cursor: pointer;
          padding: 0;
          text-decoration: underline;
          font-weight: 600;
        }

        .link-button:hover {
          color: #006d7a;
        }

        .coords-inputs {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .coord-input {
          flex: 1;
          padding: 10px 12px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 14px;
        }

        .coord-input:focus {
          outline: none;
          border-color: #008B9D;
        }

        .apply-coords-btn {
          width: 100%;
          padding: 12px;
          background: #008B9D;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .apply-coords-btn:hover {
          background: #007080;
        }

        @media (max-width: 768px) {
          .coords-inputs {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
