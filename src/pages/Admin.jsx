import React, { useState, useEffect } from 'react'
import '../styles/admin.css'

export default function Admin() {
  const [token, setToken] = useState('')
  const [syncStatus, setSyncStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')

  useEffect(() => {
    loadSyncStatus()
  }, [])

  const loadSyncStatus = async () => {
    try {
      const response = await fetch('/admin/sync-status')
      const data = await response.json()
      setSyncStatus(data)
    } catch (error) {
      console.error('Ошибка при загрузке статуса:', error)
    }
  }

  const handleSync = async (e) => {
    e.preventDefault()
    setSyncing(true)
    setMessage('')

    if (!token) {
      setMessageType('error')
      setMessage('Введите API токен')
      setSyncing(false)
      return
    }

    try {
      const response = await fetch('/admin/sync-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token })
      })

      const data = await response.json()

      if (response.ok) {
        setMessageType('success')
        setMessage(`✓ Синхронизация завершена! Загружено ${data.count} товаров`)
        setToken('')
        loadSyncStatus()
        setTimeout(() => setMessage(''), 5000)
      } else {
        setMessageType('error')
        setMessage(data.error || 'Ошибка синхронизации')
      }
    } catch (error) {
      setMessageType('error')
      setMessage('Ошибка подключения к серверу')
      console.error('Ошибка:', error)
    } finally {
      setSyncing(false)
    }
  }

  const formatDate = (isoString) => {
    if (!isoString) return 'Никогда'
    const date = new Date(isoString)
    return date.toLocaleString('ru-RU')
  }

  return (
    <div className="admin-page">
      <div className="admin-container">
        <h1>Администратор - Управление товарами</h1>

        <div className="admin-card">
          <div className="status-box">
            <h3>Статус синхронизации</h3>
            {syncStatus ? (
              <div className={syncStatus.productsCount > 0 ? 'status-success' : 'status-warning'}>
                <p><strong>Товаров в базе:</strong> {syncStatus.productsCount}</p>
                <p><strong>Последняя синхронизация:</strong> {formatDate(syncStatus.lastSync)}</p>
                {syncStatus.hasToken ? (
                  <p>✓ API токен сохранён</p>
                ) : (
                  <p>⚠️ Токен не сохранён, введите ниже</p>
                )}
              </div>
            ) : (
              <div className="status-warning">
                <p>Загрузка...</p>
              </div>
            )}
          </div>

          <form onSubmit={handleSync} className="admin-form">
            <h2>Синхронизация товаров из МойСклад</h2>

            <div className="form-group">
              <label htmlFor="token">API Токен МойСклад</label>
              <input
                type="text"
                id="token"
                name="token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Вставьте API токен"
                disabled={syncing}
                required
              />
            </div>

            <p className="info-text">
              ℹ️ Токен будет сохранён на сервере и использоваться для автоматической синхронизации.
              Товары будут загружены в базу данных и отображаться на сайте без запросов к МойСклад.
            </p>

            {message && (
              <div className={`message message-${messageType}`}>
                {message}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary admin-btn"
              disabled={syncing}
            >
              {syncing ? 'Синхронизация...' : 'Синхронизировать товары'}
            </button>
          </form>
        </div>

        <div className="info-section">
          <h3>Как получить API токен?</h3>
          <ol>
            <li>Откройте <a href="https://online.moysklad.ru" target="_blank" rel="noreferrer">МойСклад</a></li>
            <li>Перейдите в Настройки → Пользователи и права</li>
            <li>Откройте вашего пользователя</li>
            <li>Перейдите на вкладку "API"</li>
            <li>Нажмите "Создать токен" (если токена нет)</li>
            <li>Скопируйте токен и вставьте в форму выше</li>
          </ol>
          <p><strong>Важно:</strong> Токен сохраняется на сервере, вводить нужно только один раз (или при смене токена).</p>
        </div>
      </div>
    </div>
  )
}
