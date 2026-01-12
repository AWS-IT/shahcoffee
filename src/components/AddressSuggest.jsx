import React, { useEffect, useRef, useState, useCallback } from 'react';

export default function AddressSuggest({ value, onChange, onSelect, placeholder = 'Введите адрес доставки' }) {
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);
  const suggestRef = useRef(null);
  const debounceRef = useRef(null);

  // Поиск адресов через Nominatim (OpenStreetMap) - бесплатно и без ключа
  const searchAddress = useCallback(async (query) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ru&limit=5&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'ru',
          },
        }
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

  // Выбор адреса из списка
  const handleSelectAddress = (suggestion) => {
    onChange(suggestion.address);
    onSelect && onSelect(suggestion);
    setIsOpen(false);
    setSuggestions([]);
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
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="address-input"
          autoComplete="off"
        />
        {isLoading && <span className="address-loading">🔍</span>}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul ref={suggestRef} className="address-suggestions">
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
        </ul>
      )}

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
      `}</style>
    </div>
  );
}
