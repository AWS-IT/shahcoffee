import React from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import CartPage from './pages/CartPage.jsx'
import Home from './pages/Home.jsx'
import CatalogPage from './pages/CatalogPage.jsx'
import AboutPage from './pages/AboutPage.jsx'
import Admin from './pages/Admin.jsx'
//import ContactsPage from './pages/ContactsPage.jsx'
import ProductPage from './pages/ProductPage.jsx'

export default function App() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <div className="app">
      <Header isHome={isHome} />
      <main>
        <Routes>
          <Route path="/cart" element={<CartPage />} />
          <Route path="/" element={<Home />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="*" element={<h1 style={{padding: '100px', textAlign: 'center'}}>404 — Страница не найдена</h1>} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}