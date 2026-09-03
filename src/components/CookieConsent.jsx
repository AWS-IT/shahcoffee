import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      setVisible(true);
    }
  }, []);

  const acceptConsent = () => {
    localStorage.setItem('cookieConsent', 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 99999,
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        background: '#1e1e2f',
        color: '#f0f0f0',
        maxWidth: '500px',
        width: '100%',
        padding: '32px 28px',
        borderRadius: '24px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
        fontFamily: 'Arial, sans-serif',
        border: '1px solid #333',
        boxSizing: 'border-box',
        animation: 'fadeIn 0.3s ease'
      }}>
        <h2 style={{ fontSize: '22px', marginBottom: '12px', fontWeight: '600', color: '#fff' }}>
          🍪 Мы используем куки
        </h2>
        <p style={{ fontSize: '15px', lineHeight: '1.6', marginBottom: '20px', color: '#ccc' }}>
          Мы используем файлы cookie для улучшения работы сайта, аналитики и персонализации.
          Продолжая использовать сайт, вы соглашаетесь с
          <Link to="/privacy-policy" style={{ color: '#4fc3f7', textDecoration: 'underline', marginLeft: '4px' }}>
            политикой конфиденциальности
          </Link>.
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button onClick={acceptConsent} style={{
            flex: '1',
            background: '#4fc3f7',
            border: 'none',
            color: '#0a0a1a',
            padding: '12px 24px',
            borderRadius: '40px',
            fontWeight: 'bold',
            fontSize: '15px',
            cursor: 'pointer',
            minWidth: '120px',
            transition: '0.2s'
          }}
          onMouseOver={(e) => e.target.style.background = '#29b6f6'}
          onMouseOut={(e) => e.target.style.background = '#4fc3f7'}>
            Принимаю
          </button>
          <button onClick={() => setVisible(false)} style={{
            flex: '1',
            background: 'transparent',
            border: '1px solid #555',
            color: '#ccc',
            padding: '12px 24px',
            borderRadius: '40px',
            fontWeight: '400',
            fontSize: '15px',
            cursor: 'pointer',
            minWidth: '100px',
            transition: '0.2s'
          }}
          onMouseOver={(e) => { e.target.style.borderColor = '#888'; e.target.style.color = '#fff'; }}
          onMouseOut={(e) => { e.target.style.borderColor = '#555'; e.target.style.color = '#ccc'; }}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;