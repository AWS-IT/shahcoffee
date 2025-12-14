import React, { useState, useEffect } from 'react'
import '../styles/admin.css'

export default function Admin() {
  const [credentials, setCredentials] = useState({ email: '', password: '' })
  const [hasCredentials, setHasCredentials] = useState(false)
  const [currentEmail, setCurrentEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')

  useEffect(() => {
    checkCredentialsStatus()
  }, [])

  const checkCredentialsStatus = async () => {
    try {
      const response = await fetch('http://localhost:3001/admin/credentials-status')
      const data = await response.json()
      setHasCredentials(data.hasCredentials)
      if (data.email) {
        setCurrentEmail(data.email)
      }
    } catch (error) {
      console.error('Ошибка при проверке статуса:', error)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (!credentials.email || !credentials.password) {
      setMessageType('error')
      setMessage('Email и пароль обязательны')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('http://localhost:3001/admin/set-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials)
      })

      const data = await response.json()

      if (response.ok) {
        setMessageType('success')
        setMessage('✓ Credentials успешно сохранены!')
        setCredentials({ email: '', password: '' })
        setCurrentEmail(credentials.email)
        setHasCredentials(true)
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessageType('error')
        setMessage(data.error || 'Ошибка при сохранении')
      }
    } catch (error) {
      setMessageType('error')
      setMessage('Ошибка подключения к серверу')
      console.error('Ошибка:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-container">
        <h1>Администратор - Настройка МойСклад</h1>

        <div className="admin-card">
          <div className="status-box">
            <h3>Статус подключения</h3>
            {hasCredentials ? (
              <div className="status-success">
                <p>✓ Credentials установлены</p>
                <p>Email: <strong>{currentEmail}</strong></p>
                <p>Можете обновить, введя новые данные ниже</p>
              </div>
            ) : (
              <div className="status-warning">
                <p>⚠️ Credentials не установлены</p>
                <p>Введите учетные данные МойСклад ниже</p>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="admin-form">
            <h2>{hasCredentials ? 'Обновить' : 'Установить'} учетные данные</h2>

            <div className="form-group">
              <label htmlFor="email">Email аккаунта МойСклад</label>
              <input
                type="email"
                id="email"
                name="email"
                value={credentials.email}
                onChange={handleChange}
                placeholder="example@moysklad.ru"
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Пароль</label>
              <input
                type="password"
                id="password"
                name="password"
                value={credentials.password}
                onChange={handleChange}
                placeholder="••••••••"
                disabled={loading}
                required
              />
            </div>

            <p className="info-text">
              ℹ️ Эти данные будут сохранены на сервере и автоматически использоваться для загрузки товаров.
              Пользователи сайта не будут видеть окна входа.
            </p>

            {message && (
              <div className={`message message-${messageType}`}>
                {message}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary admin-btn"
              disabled={loading}
            >
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </form>
        </div>

        <div className="info-section">
          <h3>Как получить учетные данные?</h3>
          <ol>
            <li>Откройте <a href="https://online.moysklad.ru" target="_blank" rel="noreferrer">МойСклад</a></li>
            <li>Перейдите в профиль (правый верхний угол)</li>
            <li>Выберите "Настройки"</li>
            <li>Найдите раздел "API доступ" или "Интеграции"</li>
            <li>Используйте свой email и пароль аккаунта</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
