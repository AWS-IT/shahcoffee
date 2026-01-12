import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import TelegramLoginButton from './TelegramLoginButton.jsx'


export default function Header({ isHome }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { totalItems } = useCart()
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()

  const scrollToSection = (id) => {
    if (!isHome) return
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
      setIsMenuOpen(false)
    }
  }

  const menuItems = [
    { label: 'О нас', to: '/about', scroll: 'about' },
    { label: 'Карта продаж', to: '/dvs', scroll: 'dvs' },
    { label: 'Каталог', to: '/catalog', scroll: 'catalog' },
    { label: 'Контакты', to: '/footer', scroll: 'footer' },
  ]

  return (
    <>
      <header className="header">
        <div className="container">
          <div className="header__inner">
            <NavLink to="/" className="header__logo">
              ШАХ
            </NavLink>

            <nav className="header__nav">
              {menuItems.map(item => (
                isHome ? (
                  <button
                    key={item.label}
                    onClick={() => scrollToSection(item.scroll)}
                    className="header__nav-link"
                  >
                    {item.label}
                  </button>
                ) : (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    className={({ isActive }) =>
                      `header__nav-link ${isActive ? 'header__nav-link--active' : ''}`
                    }
                  >
                    {item.label}
                  </NavLink>
                )
              ))}

              {/* Иконка корзины с бейджиком */}
              <NavLink to="/cart" className="header__cart-link">
                <svg className="header__cart-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="9" cy="21" r="1"/>
                  <circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
                {totalItems > 0 && (
                  <span className="header__cart-badge">{totalItems}</span>
                )}
              </NavLink>

              {/* Личный кабинет и авторизация */}
              <div className="header__auth">
                <NavLink to="/profile" className="header__profile-btn">
                  <svg className="profile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  <span>{isAuthenticated ? (user?.first_name || 'Профиль') : 'Войти'}</span>
                </NavLink>
                {isAuthenticated && (
                  <button onClick={logout} className="header__logout-btn" title="Выйти">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                  </button>
                )}
              </div>
            </nav>

            <button
              className={`header__burger ${isMenuOpen ? 'header__burger--open' : ''}`}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Открыть меню"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
      </header>

      {/* Мобильное меню */}
      <div className={`header__mobile ${isMenuOpen ? 'header__mobile--open' : ''}`}>
        <div className="header__mobile-inner">
          <div className="header__mobile-top">
            <div className="header__mobile-logo">ШАХ</div>
            <button onClick={() => setIsMenuOpen(false)} className="header__burger header__burger--open">
              <span></span><span></span>
            </button>
          </div>

          <nav className="header__mobile-nav">
            {menuItems.map(item => (
              isHome ? (
                <button
                  key={item.label}
                  onClick={() => scrollToSection(item.scroll)}
                  className="header__mobile-link"
                >
                  {item.label}
                </button>
              ) : (
                <NavLink
                  key={item.label}
                  to={item.to}
                  className="header__mobile-link"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </NavLink>
              )
            ))}

            <NavLink
              to="/cart"
              className="header__mobile-link header__mobile-cart"
              onClick={() => setIsMenuOpen(false)}
            >
              Корзина {totalItems > 0 && `(${totalItems})`}
            </NavLink>

            <div className="header__mobile-auth">
              <TelegramLoginButton />
            </div>
          </nav>
        </div>
      </div>
    </>
  )
}