// src/components/CdConstructor/CdConstructor.jsx
import React, { useState } from 'react';

const CdConstructor = () => {
  const [logoImage, setLogoImage] = useState(null);
  const [logoSize, setLogoSize] = useState(80);
  const [logoX, setLogoX] = useState(0);
  const [logoY, setLogoY] = useState(0);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLogoImage(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleReset = () => {
    setLogoImage(null);
    setLogoSize(80);
    setLogoX(0);
    setLogoY(0);
    const input = document.getElementById('cd-logo-upload');
    if (input) input.value = '';
  };

  return (
    <section className="cd-constructor-section" id="constructor">
      <div className="container cd-constructor-section__inner">
        <div className="cd-section-title">
          <h2>Демо-конструктор логотипа</h2>
          <p className="cd-text-muted">Загрузите свой логотип и посмотрите, как он будет выглядеть на стаканчике</p>
        </div>

        <div className="cd-constructor__content">
          <div className="cd-constructor__preview" aria-hidden="true">
            <div className="cd-cup-3d">
              <div className="cd-cup-3d__wrap">
                <svg
                  className="cd-cup-3d__svg"
                  viewBox="0 0 280 380"
                  xmlns="http://www.w3.org/2000/svg"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <defs>
                    <linearGradient id="cdCupBody" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#ffffff" />
                      <stop offset="55%" stopColor="#f7f4ef" />
                      <stop offset="100%" stopColor="#ece6de" />
                    </linearGradient>
                    <linearGradient id="cdHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  <path d="M 30 55 L 250 55 L 220 340 L 60 340 Z" fill="url(#cdCupBody)" stroke="#d8d2c9" strokeWidth="3" />
                  <path d="M 45 60 L 75 60 Q 100 180 90 330 L 70 330 Q 80 180 45 60 Z" fill="url(#cdHighlight)" opacity="0.72" />
                  <ellipse cx="140" cy="55" rx="110" ry="14" fill="#ffffff" stroke="#c9c2b8" strokeWidth="3" />
                  <ellipse cx="140" cy="340" rx="80" ry="11" fill="#e3ddd4" stroke="#c9c2b8" strokeWidth="3" />
                  <g opacity="0.35" stroke="#e8e3da" strokeWidth="2" fill="none">
                    <path d="M50 100 Q140 90 230 100" />
                    <path d="M48 140 Q140 130 232 140" />
                    <path d="M46 180 Q140 170 234 180" />
                    <path d="M44 220 Q140 210 236 220" />
                    <path d="M42 260 Q140 250 238 260" />
                  </g>

                  <foreignObject
                    x={140 - logoSize / 2 + logoX}
                    y={160 - logoSize / 2 + logoY}
                    width={logoSize}
                    height={logoSize}
                  >
                    <div xmlns="http://www.w3.org/1999/xhtml" style={{ width: '100%', height: '100%' }}>
                      {logoImage ? (
                        <img
                          src={logoImage}
                          alt="Логотип"
                          style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 8 }}
                        />
                      ) : (
                        <div style={{
                          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center', gap: 8, color: '#9aa'
                        }}>
                          <svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#c7d" opacity="0.6" /></svg>
                          <span style={{ fontSize: 12 }}>Ваш логотип</span>
                        </div>
                      )}
                    </div>
                  </foreignObject>
                </svg>
              </div>
            </div>
          </div>

          <div className="cd-constructor__controls">
            <div className="cd-constructor__card">
              <h3>Настройки логотипа</h3>
              <p className="cd-text-muted">Экспериментируйте с размером и положением логотипа</p>

              <div className="cd-constructor__upload">
                <label htmlFor="cd-logo-upload" className="cd-constructor__upload-label">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  {logoImage ? 'Изменить логотип' : 'Загрузить логотип'}
                </label>
                <input id="cd-logo-upload" className="cd-constructor__upload-input" type="file" accept="image/*" onChange={handleFileUpload} />
              </div>

              {logoImage && (
                <>
                  <div className="cd-constructor__control">
                    <label>Размер логотипа: <strong>{logoSize}px</strong></label>
                    <input className="cd-constructor__slider" type="range" min="40" max="160" value={logoSize} onChange={e => setLogoSize(Number(e.target.value))} />
                  </div>

                  <div className="cd-constructor__control">
                    <label>Смещение по X: <strong>{logoX}px</strong></label>
                    <input className="cd-constructor__slider" type="range" min="-80" max="80" value={logoX} onChange={e => setLogoX(Number(e.target.value))} />
                  </div>

                  <div className="cd-constructor__control">
                    <label>Смещение по Y: <strong>{logoY}px</strong></label>
                    <input className="cd-constructor__slider" type="range" min="-150" max="150" value={logoY} onChange={e => setLogoY(Number(e.target.value))} />
                  </div>

                  <button type="button" onClick={handleReset} className="cd-constructor__reset">Сбросить</button>
                </>
              )}

              <div className="cd-constructor__hint">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#3bc9c1" strokeWidth="1.6"/><path d="M12 8v4" stroke="#3bc9c1" strokeWidth="1.6" strokeLinecap="round"/><circle cx="12" cy="16" r="0.5" fill="#3bc9c1"/></svg>
                <div>Это демо-конструктор. Всё работает в вашем браузере.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CdConstructor;
