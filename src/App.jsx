import { useEffect } from 'react'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import TelegramAuth from './components/TelegramAuth.jsx'
import Home from './pages/Home.jsx'
import CatalogPage from './pages/CatalogPage.jsx'
import AboutPage from './pages/AboutPage.jsx'
import CartPage from './pages/CartPage.jsx'
import PaymentResultPage from './pages/PaymentResultPage.jsx'
import PaymentTestPage from './pages/PaymentTestPage.jsx'
import ProductPage from './pages/ProductPage.jsx'
import OrderPage from './pages/OrderPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import Admin from './pages/Admin.jsx'

function AppContent() {
  const location = useLocation()
  const navigate = useNavigate()
  const { loginWithTelegram } = useAuth()
  const isHome = location.pathname === '/'

  // Обработка авторизации через Telegram redirect
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const telegramAuth = params.get('telegram_auth')
    const authError = params.get('auth_error')

    if (telegramAuth) {
      try {
        const userData = JSON.parse(decodeURIComponent(telegramAuth))
        loginWithTelegram(userData)
        // Убираем параметры из URL
        navigate('/', { replace: true })
      } catch (e) {
        console.error('Ошибка парсинга данных Telegram:', e)
      }
    }

    if (authError) {
      console.error('Ошибка авторизации Telegram:', authError)
      navigate('/', { replace: true })
    }
  }, [location.search, loginWithTelegram, navigate])

  return (
    <div className="app">
      <Header isHome={isHome} />
      <main>
        <Routes>
          <Route path="/cart" element={<CartPage />} />
          <Route path="/payment-result" element={<PaymentResultPage />} />
          <Route path="/order" element={<OrderPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/test-payment" element={<PaymentTestPage />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/" element={<Home />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="*" element={<h1 style={{padding: '100px', textAlign: 'center'}}>404 — Страница не найдена</h1>} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <TelegramAuth />
      <AppContent />
    </AuthProvider>
  )
}